import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = process.cwd();
const CONFIRMATION = "RESET NEXT CONTROL";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const OPERATIONAL_COLLECTIONS = [
  "obras",
  "rubrosAvance",
  "reportesAvance",
  "materialesPendientes",
  "actividadesAvance",
  "movimientosFinancieros",
  "cheques",
  "clientes",
  "proveedores",
  "oportunidades",
  "cobros",
  "actividades",
  "cuadrillas",
  "tareasInstalacion",
  "tareas",
  "jornadasCampo",
  "asignacionesCampo",
  "produccionEventos",
  "instalacionEventos",
  "ordenesProduccion"
];

const OPTIONAL_OPERATIONAL_COLLECTIONS = [
  "presupuestos",
  "inventario",
  "reportes",
  "notificaciones",
  "produccionEtapas",
  "registrosInstalacion",
  "jornadasInstalacion",
  "materiales",
  "logsOperativos",
  "resumenes",
  "dashboardSummaries"
];

const PRESERVED_COLLECTIONS = [
  "users",
  "roles",
  "permissions",
  "configuracion",
  "settings",
  "empresa",
  "branding",
  "system",
  "systemConfig"
];

const STORAGE_OPERATIONAL_PREFIXES = [
  "obras/",
  "ordenes-produccion/"
];

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...process.env
};

if (env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;
}

const expectedProjectId = env.RESET_EXPECTED_FIREBASE_PROJECT_ID
  || env.VITE_FIREBASE_PROJECT_ID
  || env.FIREBASE_PROJECT_ID
  || "next-control-bb95f";

const projectId = env.RESET_FIREBASE_PROJECT_ID
  || env.FIREBASE_PROJECT_ID
  || env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  fail("No se encontro projectId. Defini FIREBASE_PROJECT_ID, RESET_FIREBASE_PROJECT_ID o VITE_FIREBASE_PROJECT_ID.");
}

if (projectId !== expectedProjectId) {
  fail(`Proteccion activa: el proyecto objetivo '${projectId}' no coincide con '${expectedProjectId}'.`);
}

const hasExplicitCredential = Boolean(
  env.GOOGLE_APPLICATION_CREDENTIALS
    || env.FIREBASE_SERVICE_ACCOUNT_PATH
    || env.FIREBASE_SERVICE_ACCOUNT_JSON
);

if (!hasExplicitCredential && env.RESET_ALLOW_APPLICATION_DEFAULT !== "true") {
  fail("Configura una credencial Admin explicita antes de ejecutar el reset: GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON. Si queres usar Application Default Credentials, define RESET_ALLOW_APPLICATION_DEFAULT=true.");
}

initializeApp({
  credential: getCredential(),
  projectId,
  storageBucket: env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET
});

const db = getFirestore();
const bucket = getStorage().bucket();
const backupDir = getBackupDir();

console.log(`\nNEXT CONTROL operational reset ${dryRun ? "(DRY RUN)" : "(REAL)"}`);
console.log(`Proyecto verificado: ${projectId}`);
console.log(`Backup: ${backupDir}`);

const topCollections = await listTopCollectionsSafely();
fs.mkdirSync(backupDir, { recursive: true });

const existingTopLevel = new Set(topCollections.map((collectionRef) => collectionRef.id));
const optionalExisting = OPTIONAL_OPERATIONAL_COLLECTIONS.filter((name) => existingTopLevel.has(name));
const targetCollections = unique([...OPERATIONAL_COLLECTIONS, ...optionalExisting])
  .filter((name) => !PRESERVED_COLLECTIONS.includes(name));
const missingKnownCollections = OPERATIONAL_COLLECTIONS.filter((name) => !existingTopLevel.has(name));

const inventory = {
  generatedAt: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "real",
  projectId,
  preservedCollections: PRESERVED_COLLECTIONS,
  targetCollections,
  missingKnownCollections,
  storageOperationalPrefixes: STORAGE_OPERATIONAL_PREFIXES,
  collections: {},
  storage: {
    files: []
  }
};

const backup = {
  generatedAt: inventory.generatedAt,
  projectId,
  collections: {}
};

let totalDocs = 0;

for (const collectionName of targetCollections) {
  if (!existingTopLevel.has(collectionName)) {
    inventory.collections[collectionName] = { exists: false, topLevelDocuments: 0, totalDocumentsIncludingSubcollections: 0 };
    backup.collections[collectionName] = [];
    continue;
  }

  const docs = await db.collection(collectionName).get();
  const exportedDocs = [];
  let nestedCount = 0;

  for (const docSnapshot of docs.docs) {
    const exported = await exportDocumentRecursive(docSnapshot.ref);
    nestedCount += exported.documentCount;
    exportedDocs.push(exported.document);
  }

  totalDocs += nestedCount;
  inventory.collections[collectionName] = {
    exists: true,
    topLevelDocuments: docs.size,
    totalDocumentsIncludingSubcollections: nestedCount
  };
  backup.collections[collectionName] = exportedDocs;
}

let storageFiles = [];
try {
  storageFiles = await listStorageFiles(STORAGE_OPERATIONAL_PREFIXES);
  inventory.storage.files = storageFiles.map((file) => ({
    name: file.name,
    size: Number(file.metadata.size ?? 0),
    contentType: file.metadata.contentType ?? "",
    updated: file.metadata.updated ?? ""
  }));
} catch (error) {
  inventory.storage.error = stringifyError(error);
  console.warn("No se pudo inventariar Storage. El reset de Firestore sigue disponible.", error);
}

writeJson("inventory.json", inventory);
writeJson("backup.json", backup);
writeText("README.txt", buildBackupReadme(inventory, totalDocs, storageFiles.length));

printInventory(inventory, totalDocs, storageFiles.length);

if (dryRun) {
  console.log("\nDry-run finalizado. No se elimino ningun documento ni archivo.");
  process.exit(0);
}

await requireConfirmation();

const deleted = {
  documents: 0,
  topLevelDocuments: 0,
  storageFiles: 0,
  errors: []
};

for (const collectionName of targetCollections) {
  if (!existingTopLevel.has(collectionName)) continue;

  const docs = await db.collection(collectionName).get();
  for (const docSnapshot of docs.docs) {
    try {
      await db.recursiveDelete(docSnapshot.ref);
      deleted.topLevelDocuments += 1;
    } catch (error) {
      deleted.errors.push({ type: "firestore", path: docSnapshot.ref.path, error: stringifyError(error) });
    }
  }

  deleted.documents += inventory.collections[collectionName]?.totalDocumentsIncludingSubcollections ?? 0;
}

for (const fileRecord of inventory.storage.files) {
  try {
    await bucket.file(fileRecord.name).delete({ ignoreNotFound: true });
    deleted.storageFiles += 1;
  } catch (error) {
    deleted.errors.push({ type: "storage", path: fileRecord.name, error: stringifyError(error) });
  }
}

writeJson("reset-result.json", {
  finishedAt: new Date().toISOString(),
  projectId,
  deleted,
  preservedCollections: PRESERVED_COLLECTIONS,
  targetCollections
});

console.log("\nReset operativo finalizado.");
console.log(`Documentos eliminados (incluye subcolecciones): ${deleted.documents}`);
console.log(`Documentos padre eliminados: ${deleted.topLevelDocuments}`);
console.log(`Archivos de Storage eliminados: ${deleted.storageFiles}`);
console.log(`Errores: ${deleted.errors.length}`);
if (deleted.errors.length) {
  console.log(`Revisa ${path.join(backupDir, "reset-result.json")}`);
}

function readEnvFile(fileName) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) return {};

  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    result[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return result;
}

async function listTopCollectionsSafely() {
  try {
    return await db.listCollections();
  } catch (error) {
    throw new Error([
      "No se pudo conectar a Firestore con Firebase Admin SDK.",
      "Configura GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON antes de ejecutar el reset.",
      `Detalle tecnico: ${stringifyError(error)}`
    ].join(" "));
  }
}

function getCredential() {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = parseServiceAccountJson(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return cert(serviceAccount);
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = path.resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT_PATH);
    return cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")));
  }

  return applicationDefault();
}

function parseServiceAccountJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  }
}

function getBackupDir() {
  const explicitDir = env.RESET_BACKUP_DIR;
  if (explicitDir) return path.resolve(ROOT, explicitDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(ROOT, "backups", `operational-reset-${stamp}`);
}

async function exportDocumentRecursive(docRef) {
  const snapshot = await docRef.get();
  const document = {
    path: docRef.path,
    id: docRef.id,
    data: serializeFirestoreValue(snapshot.data() ?? {}),
    subcollections: {}
  };
  let documentCount = 1;

  const subcollections = await docRef.listCollections();
  for (const subcollectionRef of subcollections) {
    const subSnapshot = await subcollectionRef.get();
    document.subcollections[subcollectionRef.id] = [];
    for (const childDoc of subSnapshot.docs) {
      const exported = await exportDocumentRecursive(childDoc.ref);
      documentCount += exported.documentCount;
      document.subcollections[subcollectionRef.id].push(exported.document);
    }
  }

  return { document, documentCount };
}

function serializeFirestoreValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (value instanceof Date) return { __type: "Date", value: value.toISOString() };
  if (value?.toDate && typeof value.toDate === "function") {
    return { __type: "Timestamp", value: value.toDate().toISOString() };
  }
  if (value?.latitude !== undefined && value?.longitude !== undefined) {
    return { __type: "GeoPoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (value?.path && value?.firestore) {
    return { __type: "DocumentReference", path: value.path };
  }
  if (Buffer.isBuffer(value)) {
    return { __type: "Buffer", base64: value.toString("base64") };
  }
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeFirestoreValue(item)])
  );
}

async function listStorageFiles(prefixes) {
  const records = [];
  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix });
    records.push(...files.map((file) => ({
      name: file.name,
      metadata: file.metadata ?? {}
    })));
  }
  return uniqueBy(records, (file) => file.name);
}

async function requireConfirmation() {
  if (env.RESET_CONFIRMATION === CONFIRMATION) return;

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`\nOperacion destructiva. Escribi '${CONFIRMATION}' para continuar: `);
  rl.close();

  if (answer !== CONFIRMATION) {
    throw new Error("Confirmacion invalida. No se elimino ningun dato.");
  }
}

function printInventory(data, docsCount, filesCount) {
  console.log("\nColecciones a limpiar:");
  for (const collectionName of data.targetCollections) {
    const item = data.collections[collectionName];
    console.log(`- ${collectionName}: ${item?.exists ? `${item.topLevelDocuments} docs padre / ${item.totalDocumentsIncludingSubcollections} docs totales` : "no existe"}`);
  }

  console.log("\nColecciones conservadas:");
  for (const collectionName of data.preservedCollections) {
    console.log(`- ${collectionName}`);
  }

  console.log(`\nTotal documentos inventariados: ${docsCount}`);
  console.log(`Archivos Storage bajo prefijos operativos: ${filesCount}`);
}

function buildBackupReadme(data, docsCount, filesCount) {
  return [
    "NEXT CONTROL - Backup previo a reset operativo",
    "",
    `Fecha: ${data.generatedAt}`,
    `Proyecto: ${data.projectId}`,
    `Modo: ${data.mode}`,
    "",
    "Archivos:",
    "- inventory.json: conteo de colecciones y Storage.",
    "- backup.json: export JSON de documentos operativos y subcolecciones.",
    "- reset-result.json: aparece solo despues de un reset real.",
    "",
    `Documentos inventariados: ${docsCount}`,
    `Archivos Storage inventariados: ${filesCount}`,
    "",
    "No se incluyen usuarios de Firebase Authentication ni credenciales privadas."
  ].join("\n");
}

function writeJson(fileName, data) {
  fs.writeFileSync(path.join(backupDir, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(fileName, text) {
  fs.writeFileSync(path.join(backupDir, fileName), `${text}\n`, "utf8");
}

function unique(values) {
  return Array.from(new Set(values));
}

function uniqueBy(values, getKey) {
  const seen = new Set();
  return values.filter((value) => {
    const key = getKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringifyError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}
