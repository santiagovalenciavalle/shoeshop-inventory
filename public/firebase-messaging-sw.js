importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  projectId: "your-project-id",
  appId: "1:000000000000:web:0000000000000000",
  storageBucket: "your-project.firebasestorage.app",
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  messagingSenderId: "000000000000",
  measurementId: "G-XXXXXXXXXX",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;

  const title = payload.data?.title || "Nueva notificación";
  const body = payload.data?.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "/logo.svg",
    badge: "/logo.svg",
    data: payload.data || {},
    vibrate: [200, 100, 200],
  });
});
