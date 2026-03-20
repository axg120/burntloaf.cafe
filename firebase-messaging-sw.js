importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');

const firebaseConfig = {
    apiKey: "AIzaSyAklt2oAC5-LVYNJH0fVCaI39BlLwtLwNM",
    authDomain: "burntloafcafe-b626f.firebaseapp.com",
    projectId: "burntloafcafe-b626f",
    storageBucket: "burntloafcafe-b626f.firebasestorage.app",
    messagingSenderId: "268363899230",
    appId: "1:268363899230:web:7e53683897f476e6872fcf"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.notification.body,
        icon: '/assets/icon.jpeg'
    };
    event.waitUntil(self.registration.showNotification(data.notification.title, options));
});
