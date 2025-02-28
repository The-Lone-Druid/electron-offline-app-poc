# Prompt for Claude 3.5 Sonnet in Cursor IDE

**Context:**
I am building a **Proof of Concept (POC)** for an Electron.js application that demonstrates offline capabilities. The application should:

1. Store data locally using **IndexedDB** for offline access.
2. Sync data with a remote server when the app goes back online.
3. Handle offline scenarios gracefully, including error handling and user feedback.
4. Follow offline-first architecture best practices.

**Requirements:**

1. **Local Data Storage**: Use IndexedDB to store data locally.
2. **Synchronization**: Implement logic to sync local data with a remote server when the app is online.
3. **Offline-First Design**: Ensure the app works seamlessly offline and syncs data when connectivity is restored.
4. **Error Handling**: Provide meaningful feedback to users when the app is offline or encounters errors.
5. **Testing**: Simulate offline mode and test the app's behavior.

**Current Progress:**

- I have set up a basic Electron.js project with `main.js`, `index.html`, and `renderer.js`.
- I have implemented basic IndexedDB functionality for local data storage.
- I need help refining the implementation, adding synchronization logic, and ensuring the app follows offline-first best practices.

**Tasks for Claude:**

1. **Refine IndexedDB Implementation**:
   - Provide a clean and efficient implementation of IndexedDB for storing and retrieving data.
   - Include error handling for database operations.

2. **Add Synchronization Logic**:
   - Implement logic to sync local data with a remote server when the app is online.
   - Use a mock API or simulate server communication for the POC.

3. **Offline-First Best Practices**:
   - Suggest and implement best practices for offline-first design in Electron.js.
   - Ensure the app provides clear feedback to users about their online/offline status.

4. **Error Handling**:
   - Add error handling for scenarios like failed database operations or sync failures.
   - Provide user-friendly error messages.

5. **Testing Guidance**:
   - Suggest ways to test the app's offline functionality, including simulating offline mode.
   - Provide tips for debugging and improving the app's offline performance.

**Deliverables:**

1. Code snippets for the refined IndexedDB implementation.
2. Code snippets for the synchronization logic.
3. Best practices for offline-first design in Electron.js.
4. Error handling and user feedback implementation.
5. Testing and debugging tips.

**Example Code (Current Implementation):**

```javascript
// renderer.js
let db;

const request = indexedDB.open('OfflineAppDB', 1);

request.onupgradeneeded = (event) => {
  db = event.target.result;
  if (!db.objectStoreNames.contains('dataStore')) {
    db.createObjectStore('dataStore', { keyPath: 'id', autoIncrement: true });
  }
};

request.onsuccess = (event) => {
  db = event.target.result;
  console.log('Database ready.');
};

request.onerror = (event) => {
  console.error('Error opening database:', event.target.error);
};

document.getElementById('saveButton').addEventListener('click', () => {
  const data = document.getElementById('dataInput').value;
  if (!data) return;

  const transaction = db.transaction('dataStore', 'readwrite');
  const store = transaction.objectStore('dataStore');
  store.add({ value: data });

  console.log('Data saved locally.');
});
```

**Questions for Claude:**

1. How can I improve the IndexedDB implementation for better performance and reliability?
2. What is the best way to implement synchronization logic for syncing local data with a remote server?
3. How can I ensure the app follows offline-first best practices?
4. What are some common pitfalls when building offline-capable Electron.js apps, and how can I avoid them?
5. How can I simulate offline mode and test the app's behavior effectively?
