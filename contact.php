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

if ($nom === '' || !filter_var($email, FILTER_VALIDATE_EMAIL))
    reply(false, "Indiquez votre nom et une adresse e-mail valide.", $wantsJson);

// limite simple : 1 envoi / 30 s par adresse IP
$lock = sys_get_temp_dir() . '/ap_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
if (is_file($lock) && time() - filemtime($lock) < 30) reply(false, "Merci de patienter quelques secondes avant un nouvel envoi.", $wantsJson);
@touch($lock);

$subject = '=?UTF-8?B?' . base64_encode("Demande de devis : $type — $nom") . '?=';
$body = "Nouvelle demande depuis artisan-pisciniste.fr\n\n"
      . "Projet   : $type\nNom      : $nom\nTéléphone: $tel\nE-mail   : $email\nCommune  : $commune\n\nMessage :\n$msg\n";
$headers = "From: Artisan Pisciniste <$FROM>\r\nReply-To: $email\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
$ok = mail($TO, $subject, $body, $headers, '-f' . $FROM);
reply($ok, $ok ? '' : "L'envoi a échoué. Appelez le 06 52 08 92 19.", $wantsJson);
