<?php
/* Formulaire de devis — artisan-pisciniste.fr
 * Envoie la demande par e-mail. Réglage : modifier contact-config.php (adresse de réception). */
declare(strict_types=1);
$cfg = is_file(__DIR__ . '/contact-config.php') ? require __DIR__ . '/contact-config.php' : [];
$TO   = $cfg['to']   ?? '';
$FROM = $cfg['from'] ?? 'site@artisan-pisciniste.fr';

$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
function reply(bool $ok, string $msg, bool $json): void {
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode(['ok' => $ok, 'error' => $ok ? null : $msg], JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: /?envoi=' . ($ok ? 'ok' : 'erreur') . '#contact', true, 303);
    }
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Location: /#contact', true, 303); exit; }
if (!empty($_POST['site'])) reply(true, '', $wantsJson);            // robot : on fait semblant
if ($TO === '') reply(false, "Le formulaire n'est pas encore configuré. Appelez le 06 52 08 92 19.", $wantsJson);

$clean = fn(string $k, int $max) => trim(mb_substr(str_replace(["\r", "\0"], '', (string)($_POST[$k] ?? '')), 0, $max));
$nom = $clean('nom', 120); $tel = $clean('tel', 40); $email = $clean('email', 160);
$commune = $clean('commune', 120); $type = $clean('type', 60); $msg = $clean('message', 5000);
$nom = str_replace("\n", ' ', $nom); $commune = str_replace("\n", ' ', $commune); $type = str_replace("\n", ' ', $type);

// Tous les champs sont obligatoires (même contrôle que dans le navigateur)
$missing = [];
if (mb_strlen($nom) < 2) $missing[] = 'nom et prénom';
if (strlen(preg_replace('/\D/', '', $tel) ?? '') < 10) $missing[] = 'téléphone';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $missing[] = 'e-mail valide';
if (mb_strlen($commune) < 2) $missing[] = 'commune du chantier';
if (mb_strlen($msg) < 5) $missing[] = 'message';
if ($missing) reply(false, 'Merci de compléter : ' . implode(', ', $missing) . '.', $wantsJson);

// limite simple : 1 envoi / 30 s par adresse IP
$lock = sys_get_temp_dir() . '/ap_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
if (is_file($lock) && time() - filemtime($lock) < 30) reply(false, "Merci de patienter quelques secondes avant un nouvel envoi.", $wantsJson);
@touch($lock);

require __DIR__ . '/mail-template.php';
$now  = new DateTimeImmutable('now', new DateTimeZone('Europe/Paris'));
$ref  = 'AP-' . $now->format('ymd-Hi') . '-' . strtoupper(bin2hex(random_bytes(2)));
$page = parse_url((string)($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_PATH) ?: '';
$mail = ap_devis_email(['nom' => $nom, 'tel' => $tel, 'email' => $email, 'commune' => $commune, 'type' => $type,
                        'message' => $msg, 'ref' => $ref, 'date' => $now, 'page' => $page]);

// E-mail HTML + version texte + logo intégré (affiché même si les images distantes sont bloquées)
$bR = 'rel_' . bin2hex(random_bytes(8)); $bA = 'alt_' . bin2hex(random_bytes(8));
$logo = chunk_split(base64_encode((string)@file_get_contents(__DIR__ . '/assets/img/logo-mail.png')));
$body = "--$bR\r\nContent-Type: multipart/alternative; boundary=\"$bA\"\r\n\r\n"
      . "--$bA\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($mail['text'])) . "\r\n"
      . "--$bA\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($mail['html'])) . "\r\n"
      . "--$bA--\r\n\r\n"
      . "--$bR\r\nContent-Type: image/png; name=\"logo.png\"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <" . AP_LOGO_CID . ">\r\nContent-Disposition: inline; filename=\"logo.png\"\r\n\r\n" . $logo . "\r\n"
      . "--$bR--\r\n";
$subject = '=?UTF-8?B?' . base64_encode($mail['subject']) . '?=';
$fromName = '=?UTF-8?B?' . base64_encode('Site Artisan Pisciniste') . '?=';
$headers = "From: $fromName <$FROM>\r\nReply-To: " . str_replace(["\r", "\n"], '', $nom) . " <$email>\r\n"
         . "MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary=\"$bR\"; type=\"multipart/alternative\"\r\n"
         . "X-AP-Reference: $ref\r\n";
$ok = mail($TO, $subject, $body, $headers, '-f' . $FROM);
reply($ok, $ok ? '' : "L'envoi a échoué. Appelez le 06 52 08 92 19.", $wantsJson);
