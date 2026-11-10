<?php
/* Mini CRM — stockage des demandes de devis (SQLite).
 * Le fichier de données est rangé HORS de public_html (dossier crm-data à côté),
 * pour qu'il ne soit jamais accessible depuis le web ni écrasé par un déploiement Git.
 * Accès direct à ce fichier bloqué par .htaccess. */
declare(strict_types=1);

const CRM_STATUTS = [
    'nouvelle' => 'Nouvelle',
    'en_cours' => 'En cours',
    'devis'    => 'Devis envoyé',
    'gagnee'   => 'Gagnée',
    'perdue'   => 'Perdue',
];
const CRM_TYPES = ['Piscine neuve', 'Mini piscine', 'Changement de liner', 'Pompe et filtration', 'Rénovation', 'Entretien', 'Autre'];

function crm_now(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d H:i:s');
}

/** Dossier des données : à côté de public_html si possible, sinon dans un sous-dossier interdit d'accès. */
function crm_dir(): string {
    static $dir = null;
    if ($dir !== null) return $dir;
    $outside = dirname(__DIR__) . '/crm-data';
    if (!is_dir($outside)) @mkdir($outside, 0700, true);
    if (is_dir($outside) && is_writable($outside)) return $dir = $outside;
    $inside = __DIR__ . '/crm-data';
    if (!is_dir($inside)) @mkdir($inside, 0700, true);
    if (!is_file("$inside/.htaccess")) @file_put_contents("$inside/.htaccess", "Require all denied\n");
    return $dir = $inside;
}

function crm_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $pdo = new PDO('sqlite:' . crm_dir() . '/crm.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('CREATE TABLE IF NOT EXISTS demandes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ref TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT \'site\',
        nom TEXT NOT NULL DEFAULT \'\', tel TEXT NOT NULL DEFAULT \'\', email TEXT NOT NULL DEFAULT \'\',
        commune TEXT NOT NULL DEFAULT \'\', type TEXT NOT NULL DEFAULT \'\', message TEXT NOT NULL DEFAULT \'\', page TEXT NOT NULL DEFAULT \'\',
        statut TEXT NOT NULL DEFAULT \'nouvelle\', montant REAL, relance TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, demande_id INTEGER NOT NULL, at TEXT NOT NULL, texte TEXT NOT NULL, auto INTEGER NOT NULL DEFAULT 0)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS notes_demande ON notes(demande_id)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS reglages (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS tentatives (ip TEXT NOT NULL, at INTEGER NOT NULL)');
    return $pdo;
}

function crm_new_ref(): string {
    return 'AP-' . (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format('ymd-Hi') . '-' . strtoupper(bin2hex(random_bytes(2)));
}

/** Enregistre une demande et renvoie son identifiant. */
function crm_add(array $d, string $source = 'site'): int {
    $db = crm_db();
    $now = crm_now();
    $st = $db->prepare('INSERT INTO demandes (ref, created_at, updated_at, source, nom, tel, email, commune, type, message, page, statut)
                        VALUES (:ref, :c, :c, :src, :nom, :tel, :email, :commune, :type, :message, :page, \'nouvelle\')');
    $st->execute([':ref' => $d['ref'] ?? crm_new_ref(), ':c' => $now, ':src' => $source,
        ':nom' => $d['nom'] ?? '', ':tel' => $d['tel'] ?? '', ':email' => $d['email'] ?? '', ':commune' => $d['commune'] ?? '',
        ':type' => $d['type'] ?? '', ':message' => $d['message'] ?? '', ':page' => $d['page'] ?? '']);
    $id = (int)$db->lastInsertId();
    crm_note($id, $source === 'site' ? 'Demande reçue par le formulaire du site.' : 'Demande ajoutée à la main.', true);
    return $id;
}

function crm_note(int $id, string $texte, bool $auto = false): void {
    crm_db()->prepare('INSERT INTO notes (demande_id, at, texte, auto) VALUES (?, ?, ?, ?)')->execute([$id, crm_now(), $texte, $auto ? 1 : 0]);
}

function crm_get(int $id): ?array {
    $st = crm_db()->prepare('SELECT * FROM demandes WHERE id = ?');
    $st->execute([$id]);
    $r = $st->fetch();
    return $r ?: null;
}

function crm_setting(string $k, ?string $v = null): ?string {
    $db = crm_db();
    if ($v !== null) {
        $db->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$k, $v]);
        return $v;
    }
    $st = $db->prepare('SELECT v FROM reglages WHERE k = ?');
    $st->execute([$k]);
    $r = $st->fetchColumn();
    return $r === false ? null : (string)$r;
}
