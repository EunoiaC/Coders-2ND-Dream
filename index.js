// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAgHxgz4BD3mxvUFJrr2KUDGER6LElf790",
    authDomain: "coder-s-second-dream.firebaseapp.com",
    projectId: "coder-s-second-dream",
    storageBucket: "coder-s-second-dream.firebasestorage.app",
    messagingSenderId: "249976919261",
    appId: "1:249976919261:web:1ae131ec4951f17860b734",
    measurementId: "G-DPJLSV4CS2"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
// const analytics = getAnalytics(app);

const loginPage = document.getElementById("login");
const homePage = document.getElementById("home");

let pages = [loginPage, homePage];

function showPage(page) {
    // hide all possible other pages
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.add("d-none");
    }

    page.classList.remove("d-none");
}

// start by showing the login page unless already signed in
showPage(loginPage);

const githubAuthProvider = new firebase.auth.GithubAuthProvider();
const githubSignInButton = document.getElementById('signInGithub');
githubSignInButton.addEventListener('click', () => {
    auth.signInWithPopup(githubAuthProvider)
        .then((result) => {
            // User is signed in.
            const user = result.user;
            // ... (Do something with the user's data)
            if (result.additionalUserInfo.isNewUser) {
                // This is a sign-up
                console.log('User signed up:', user);
            } else {
                // This is a log-in
                console.log('User logged in:', user);
            }

            showPage(homePage);
        })
        .catch((error) => {
            // Handle Errors here.
            const errorCode = error.code;
            const errorMessage = error.message;
            // The email of the user's account used.
            const email = error.email;
            // ...
            console.log(errorMessage);
        });
});

function signOut() {
    auth.signOut()
        .then(() => {
            // Sign-out successful.
            console.log("User signed out.");
            // ... (Do something after sign-out)
        })
        .catch((error) => {
            // An error happened.
            console.error("Error signing out:", error);
        });
}

