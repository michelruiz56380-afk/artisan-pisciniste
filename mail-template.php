<?php
/* Modèle de l'e-mail « nouvelle demande de devis » envoyé à Olivier.
 * Utilisé par contact.php. Accès direct bloqué par .htaccess. */
declare(strict_types=1);

const AP_LOGO_CID = 'logo@artisan-pisciniste.fr';

function ap_date_fr(DateTimeInterface $d): string {
    $jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    $mois  = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return $jours[(int)$d->format('w')] . ' ' . $d->format('j') . ' ' . $mois[(int)$d->format('n') - 1] . ' ' . $d->format('Y') . ' à ' . $d->format('H\hi');
}

/** Numéro saisi -> lien tel: international (06 12 34 56 78 -> +33612345678). */
function ap_tel_href(string $tel): string {
    $t = preg_replace('/[^\d+]/', '', $tel) ?? '';
    if (str_starts_with($t, '00')) $t = '+' . substr($t, 2);
    elseif (str_starts_with($t, '0')) $t = '+33' . substr($t, 1);
    return $t;
}

/**
 * @param array{nom:string,tel:string,email:string,commune:string,type:string,message:string,ref:string,date:DateTimeInterface,page:string} $d
 * @return array{subject:string,html:string,text:string}
 */
function ap_devis_email(array $d): array {
    $h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $quand   = ap_date_fr($d['date']);
    $type    = $d['type'] !== '' ? $d['type'] : 'Projet non précisé';
    $commune = $d['commune'];
    $subject = "Demande de devis : $type — {$d['nom']}" . ($commune !== '' ? " ($commune)" : '');

    $telHref  = ap_tel_href($d['tel']);
    $mailHref = 'mailto:' . rawurlencode($d['email']) . '?subject=' . rawurlencode("Votre demande de devis piscine ({$d['ref']})");
    $mapHref  = 'https://www.google.com/maps/search/' . rawurlencode($commune . ', Morbihan');
    $msgHtml  = $d['message'] !== '' ? nl2br($h($d['message'])) : '<span style="color:#8a93a8">Aucun message.</span>';

    $row = function (string $label, string $valueHtml) : string {
        return '<tr><td style="padding:14px 0;border-bottom:1px solid #e6e9f0;width:150px;vertical-align:top;font-size:13px;color:#5a6478">' . $label . '</td>'
             . '<td style="padding:14px 0;border-bottom:1px solid #e6e9f0;vertical-align:top;font-size:16px;color:#0c1222;font-weight:600">' . $valueHtml . '</td></tr>';
    };
    $dash = '<span style="color:#8a93a8;font-weight:400">Non renseigné</span>';
    $rows = $row('Client', $h($d['nom']))
          . $row('Téléphone', $d['tel'] !== '' ? '<a href="tel:' . $h($telHref) . '" style="color:#3b5cf0;text-decoration:none">' . $h($d['tel']) . '</a>' : $dash)
          . $row('E-mail', '<a href="' . $h($mailHref) . '" style="color:#3b5cf0;text-decoration:none">' . $h($d['email']) . '</a>')
          . $row('Commune du chantier', $commune !== '' ? $h($commune) : $dash)
          . $row('Type de projet', $h($type));

    $btn = fn(string $href, string $label, bool $primary) =>
        '<a href="' . $h($href) . '" style="display:inline-block;margin:0 8px 10px 0;padding:12px 20px;border-radius:999px;font-size:15px;font-weight:600;white-space:nowrap;text-decoration:none;'
        . ($primary ? 'background:#4f70ff;color:#ffffff' : 'background:#eef1f8;color:#1b2a78') . '">' . $label . '</a>';
    $crm = $d['crm_url'] ?? '';
    $buttons = ($crm !== '' ? '<a href="' . $h($crm) . '" style="display:inline-block;margin:0 8px 10px 0;padding:12px 20px;border-radius:999px;font-size:15px;font-weight:600;white-space:nowrap;text-decoration:none;background:#050a1f;color:#ffffff">Ouvrir dans le CRM</a>' : '')
             . ($d['tel'] !== '' ? $btn('tel:' . $telHref, 'Appeler le client', true) : '')
             . $btn($mailHref, 'Répondre par e-mail', $d['tel'] === '')
             . ($commune !== '' ? $btn($mapHref, 'Voir la commune', false) : '');

    $html = <<<HTML
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{$h($subject)}</title></head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden">{$h($type)} · {$h($d['nom'])}{$h($commune !== '' ? ' · ' . $commune : '')} · {$h($quand)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

  <tr><td style="background:#050a1f;background-image:linear-gradient(160deg,#1b2a78 0%,#050a1f 70%);border-radius:24px 24px 0 0;padding:32px 32px 28px;text-align:center">
    <img src="cid:{$h(AP_LOGO_CID)}" width="84" height="84" alt="Artisan Pisciniste" style="display:block;margin:0 auto 16px;border:0">
    <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#46c9e6;font-weight:600">Nouvelle demande de devis</div>
    <div style="font-size:28px;line-height:1.2;color:#ffffff;font-weight:700;margin-top:8px">{$h($d['nom'])}</div>
    <div style="font-size:15px;color:#a3adc9;margin-top:8px">{$h(ucfirst($quand))}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:24px 32px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;color:#5a6478">Référence <strong style="color:#0c1222;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.02em">{$h($d['ref'])}</strong></td>
      <td align="right"><span style="display:inline-block;background:#eef1ff;color:#3b5cf0;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600">{$h($type)}</span></td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:8px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{$rows}</table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:22px 32px 6px">
    <div style="font-size:13px;color:#5a6478;margin-bottom:10px">Message du client</div>
    <div style="background:#f4f6fb;border-left:3px solid #46c9e6;border-radius:12px;padding:16px 18px;font-size:16px;line-height:1.55;color:#0c1222">{$msgHtml}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:22px 32px 24px;border-radius:0 0 24px 24px">
    <div>{$buttons}</div>
  </td></tr>

  <tr><td style="padding:18px 24px;text-align:center;font-size:12px;line-height:1.6;color:#7a8398">
    Demande envoyée depuis le formulaire de <a href="https://artisan-pisciniste.fr" style="color:#5a6478">artisan-pisciniste.fr</a>{$h($d['page'] === '/' ? ' (page d\'accueil)' : ($d['page'] !== '' ? ' (page ' . $d['page'] . ')' : ''))}.<br>
    « Répondre » dans votre messagerie écrit directement au client.<br>
    ORPES · Olivier Rousseau · 28 rue des Écoles, 56250 Elven
  </td></tr>

</table>
</td></tr></table>
</body></html>
HTML;

    $text = "NOUVELLE DEMANDE DE DEVIS\n"
          . "Référence : {$d['ref']}\nReçue le  : $quand\n\n"
          . "Client    : {$d['nom']}\nTéléphone : " . ($d['tel'] ?: 'non renseigné') . "\nE-mail    : {$d['email']}\n"
          . "Commune   : " . ($commune ?: 'non renseignée') . "\nProjet    : $type\n\n"
          . "Message :\n" . ($d['message'] ?: '(aucun)') . "\n\n"
          . (($d['crm_url'] ?? '') !== '' ? "Ouvrir dans le CRM : {$d['crm_url']}\n\n" : '')
          . "-- \nEnvoyé depuis le formulaire de artisan-pisciniste.fr. « Répondre » écrit directement au client.\n";

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}

/**
 * Envoie un e-mail HTML + texte avec le logo intégré, et éventuellement une pièce jointe.
 * $pj = ['name' => 'devis.pdf', 'type' => 'application/pdf', 'data' => <octets>]
 */
function ap_send(string $to, string $subject, string $html, string $text, string $fromEmail, string $fromName,
                 string $replyTo = '', string $bcc = '', ?array $pj = null, array $extra = []): bool {
    $enc = fn(string $s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $clean = fn(string $s) => str_replace(["\r", "\n"], '', $s);
    $bA = 'alt_' . bin2hex(random_bytes(8)); $bR = 'rel_' . bin2hex(random_bytes(8)); $bM = 'mix_' . bin2hex(random_bytes(8));
    $logo = chunk_split(base64_encode((string)@file_get_contents(__DIR__ . '/assets/img/logo-mail.png')));
    $related = "Content-Type: multipart/related; boundary=\"$bR\"; type=\"multipart/alternative\"\r\n\r\n"
        . "--$bR\r\nContent-Type: multipart/alternative; boundary=\"$bA\"\r\n\r\n"
        . "--$bA\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text)) . "\r\n"
        . "--$bA\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n"
        . "--$bA--\r\n\r\n"
        . "--$bR\r\nContent-Type: image/png; name=\"logo.png\"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <" . AP_LOGO_CID . ">\r\nContent-Disposition: inline; filename=\"logo.png\"\r\n\r\n" . $logo . "\r\n"
        . "--$bR--\r\n";
    if ($pj) {
        $name = $clean(preg_replace('/[^\w.\- ]+/u', '_', $pj['name']) ?? 'piece-jointe');
        // nom de fichier : tel quel s'il est en ASCII, sinon encodé selon la RFC 2231
        $fn = fn(string $k, string $v) => preg_match('/^[\x20-\x7E]+$/', $v) ? "$k=\"" . str_replace('"', '', $v) . "\"" : "$k*=UTF-8''" . rawurlencode($v);
        $body = "--$bM\r\n" . $related . "\r\n"
            . "--$bM\r\nContent-Type: {$pj['type']}; " . $fn('name', $name) . "\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; " . $fn('filename', $name) . "\r\n\r\n"
            . chunk_split(base64_encode($pj['data'])) . "\r\n--$bM--\r\n";
        [$ctHeader, $body] = ["Content-Type: multipart/mixed; boundary=\"$bM\"", $body];
    } else {
        [$ctHeaderRaw, $rest] = explode("\r\n\r\n", $related, 2);
        [$ctHeader, $body] = [$ctHeaderRaw, $rest];
    }
    $headers = "From: {$enc($fromName)} <" . $clean($fromEmail) . ">\r\n"
        . ($replyTo !== '' ? "Reply-To: " . $clean($replyTo) . "\r\n" : '')
        . ($bcc !== '' ? "Bcc: " . $clean($bcc) . "\r\n" : '')
        . "MIME-Version: 1.0\r\n$ctHeader\r\n";
    foreach ($extra as $k => $v) $headers .= $clean($k) . ': ' . $clean($v) . "\r\n";
    return mail($clean($to), $enc($subject), $body, $headers, '-f' . $clean($fromEmail));
}

/** Réponse d'Olivier au client : texte libre + signature avec logo. */
function ap_reply_email(string $corps): array {
    $h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $paras = '';
    foreach (preg_split("/\n\s*\n/", trim(str_replace("\r", '', $corps))) as $p)
        $paras .= '<p style="margin:0 0 16px">' . nl2br($h(trim($p))) . '</p>';
    $html = <<<HTML
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0c1222">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td style="font-size:16px;line-height:1.6;color:#0c1222">{$paras}</td></tr>
  <tr><td style="padding-top:8px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6e9f0;padding-top:18px"><tr>
      <td style="padding:18px 16px 0 0;vertical-align:top"><img src="cid:{$h(AP_LOGO_CID)}" width="56" height="56" alt="Artisan Pisciniste" style="display:block;border:0"></td>
      <td style="padding-top:18px;vertical-align:top;font-size:14px;line-height:1.5;color:#5a6478">
        <strong style="font-size:16px;color:#0c1222">Olivier Rousseau</strong><br>
        Artisan pisciniste · Elven (56)<br>
        <a href="tel:+33652089219" style="color:#3b5cf0;text-decoration:none">06 52 08 92 19</a> ·
        <a href="https://artisan-pisciniste.fr" style="color:#3b5cf0;text-decoration:none">artisan-pisciniste.fr</a>
      </td></tr></table>
  </td></tr>
</table></td></tr></table>
</body></html>
HTML;
    $text = trim($corps) . "\n\n-- \nOlivier Rousseau\nArtisan pisciniste · Elven (56)\n06 52 08 92 19 · https://artisan-pisciniste.fr\n";
    return ['html' => $html, 'text' => $text];
}
