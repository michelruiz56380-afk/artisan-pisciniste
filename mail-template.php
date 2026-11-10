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
    $buttons = ($d['tel'] !== '' ? $btn('tel:' . $telHref, 'Appeler le client', true) : '')
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
          . "-- \nEnvoyé depuis le formulaire de artisan-pisciniste.fr. « Répondre » écrit directement au client.\n";

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}
