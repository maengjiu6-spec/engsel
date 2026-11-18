const DB_NAME = "engsel-images";
const STORE = "images";
const VERSION = 2;

type StoredImage = {
  blob?: Blob;
  name?: string;
};

function openImageDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function imageRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openImageDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      }),
  );
}

export function readPassageImage(id: string) {
  return imageRequest<StoredImage | undefined>("readonly", (store) => store.get(id)).then((record) => {
    if (!record?.blob) return null;
    return {
      blob: record.blob,
      name: typeof record.name === "string" ? record.name : "",
    };
  });
}

export function savePassageImage(id: string, file: Blob, name: string) {
  return imageRequest("readwrite", (store) => store.put({ blob: file, name }, id)).then(() => undefined);
}

export function removePassageImage(id: string) {
  return imageRequest("readwrite", (store) => store.delete(id)).then(() => undefined);
}
