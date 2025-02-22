import {marked} from "marked";
import {initializeApp} from "firebase/app";
import {
    getAdditionalUserInfo,
    getAuth,
    GithubAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    updateProfile
} from "firebase/auth";
import {doc, getDoc, getFirestore, setDoc, updateDoc} from 'firebase/firestore';

// TODO: If users are experiencing bad performance or UI issues, check if it's due to adding listeners over and over
// TODO: free tier AI chat: https://chatgpt.com/share/679aa90e-f540-8007-8bf9-d87b7e36b6cc
// TODO: use a serverless function to make matches, check the user subscription level and info to stop inspect-elemented matches
// TODO: tally number of match requests/profile views, and lock an account if reaching membership limits. Set a timestamp, wait a week to unlock acc

// TODO: when plan changes, set lastFetch to null

// TODO:
//  Add an incoming match requests list with the UID of pending matches that can be rejected or accepted
//  - Accepting a match leads to the creation of a chatroom stored in the openChats list in both user documents
//  - Need to create a "chats" collection where a chat can only be read by the two users, not written

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
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// const analytics = getAnalytics(app);

const loginPage = document.getElementById("login");
const homePage = document.getElementById("home");
const registerPage = document.getElementById("register");
const profilePage = document.getElementById("profile");
const matchpoolPage = document.getElementById("matchpool");

let pages = [loginPage, homePage, registerPage, profilePage, matchpoolPage];
let viewingSelf = false;
let currentProfileData = null

// calculate aura
function calculateAura(selfRequestedMatches, otherRequestedMatches, successfulMatches, selfCapabilities) {
    if (selfRequestedMatches < 0 || otherRequestedMatches < 0 || successfulMatches < 0) {
        throw new Error("Match values cannot be negative");
    }

    const requestRatio = otherRequestedMatches / (selfRequestedMatches + 1); // Avoid division by zero
    const matchFactor = successfulMatches / (selfRequestedMatches + otherRequestedMatches + 1);

    let aura = Math.round(((requestRatio * 2 + matchFactor * 3) * 50) / 50) * 50; // Weighted scaling and rounding to nearest 50

    if (selfCapabilities === 2) {
        aura += 100;
    } else {
        aura += 50;
    }

    return Math.max(aura, 0); // Ensure non-negative aura values
}

function formatNumberWithUnits(number) {
    if (number >= 1000) {
        return (number / 1000).toFixed(1) + 'k';
    } else if (number >= 1000000) {
        return (number / 1000000).toFixed(1) + 'm';
    } else {
        return number.toString();
    }
}

async function showPage(page, data = null) {
    // hide all possible other pages
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.add("d-none");
    }

    page.classList.remove("d-none");

    if (page === registerPage) {
        // clear the config console
        const console = document.getElementById("configConsoleOutput");
        console.innerText = ""
    } else if (page === matchpoolPage) {
        await showMatchPool();
    } else if (page === profilePage) {
        const pfp = document.getElementById("profile-pfp");
        const name = document.getElementById("profile-name");
        const age = document.getElementById("profile-age");
        const aura = document.getElementById("profile-aura");

        const profileEditReadme = document.getElementById("profile-edit-readme");

        // only read the current user's data unless a different user data is passed as an arg
        if (!data) {
            const docRef = doc(db, "users", auth.currentUser.uid);
            const docSnap = await getDoc(docRef);
            data = docSnap.data();
            profileEditReadme.classList.remove("d-none");
        } else {
            profileEditReadme.classList.add("d-none"); // hide the edit button since viewing a different profile
        }

        currentProfileData = data;

        const profileReadmeText = document.getElementById("profile-readme-text");

        const selfCapabilities = document.getElementById("profile-self");
        const langTitle = document.getElementById("profile-self-lang");
        const lookingFor = document.getElementById("profile-looking-for");

        let stack = ["Front End", "Back End", "Full Stack"]

        selfCapabilities.innerHTML = "<i class=\"fa-solid fa-code\"></i> " + stack[data.selfCapabilities];
        langTitle.innerHTML = "<i class=\"fa-solid fa-code\"></i> " + stack[data.selfCapabilities];
        lookingFor.innerHTML = "<i class=\"fa-solid fa-magnifying-glass\"></i> " + stack[data.lookingFor];

        profileReadmeText.innerHTML = marked(data.readme, {gfm: true});

        if (data.pfpVersion) {
            pfp.src = data.pfpLink + "?v=" + data.pfpVersion;
        } else {
            pfp.src = data.pfpLink;
        }

        let bday = new Date(data.bday[2], data.bday[0] - 1, data.bday[1]); // Month is 0-based
        let ageDifMs = Date.now() - bday.getTime();
        let ageNum = Math.floor(ageDifMs / (1000 * 60 * 60 * 24 * 365.25)); // More accurate age calculation

        name.textContent = data.displayName;
        age.textContent = "Age: " + ageNum;

        // TODO: add subscription level to aura
        let auraNum = calculateAura(data.selfRequestedMatches, data.otherRequestedMatches, data.successfulMatches, data.selfCapabilities);
        aura.innerText = "Aura: " + formatNumberWithUnits(auraNum) + "🔥";

        let knownLangs = data.knownLangs;
        let profileLanguages = document.getElementById("profile-languages");
        profileLanguages.innerHTML = "";
        for (let i = 0; i < knownLangs.length; i++) {
            let lang = knownLangs[i];
            if (lang === "c#") {
                lang = "csharp";
            }
            profileLanguages.innerHTML += `
            <img class="profile-lang-img" src="${lang}logo.png">
            `
        }
    }
}

function currentPage() {
    for (let i = 0; i < pages.length; i++) {
        let page = pages[i];
        if (!page.classList.contains("d-none")) {
            return page;
        }
    }
    return null;
}

const authListener = async (user) => {
    if (user) {

        const dname = document.getElementById("configDisplayName");
        const email = document.getElementById("configEmail");

        try {
            dname.innerText = user.displayName;
        } catch (e) {
            dname.innerText = "";
        }
        email.innerText = user.email;

        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) { // registered user
            viewingSelf = true;
            if (currentPage() === null) { // show page immediately
                showPage(profilePage);
            } else { // at login
                setTimeout(() => {
                    showPage(profilePage);
                }, 2000);
            }
        } else { // unregistered user
            if (currentPage() === null) { // show page immediately
                showPage(registerPage);
            } else {
                setTimeout(() => {
                    showPage(registerPage);
                }, 2000);
            }

        }
    } else {
        // No user is signed in. (make sure we are not already at login)
        if (!currentPage()) {
            showPage(loginPage);
            loadTerminal();
        } else if (currentPage() !== loginPage) {
            showPage(loginPage);
            loadTerminal();
        }
    }
}

// initial page data filling
function begin() {
    loadConfig(); // only load once
    loadProfilePage();
    initSubscribe();
    onAuthStateChanged(auth, authListener);
}

function initSubscribe() {
    const free = document.getElementById("sub-free");
    const intern = document.getElementById("sub-intern");
    const salesforce = document.getElementById("sub-salesforce");
    const ap = document.getElementById("sub-ap");

    free.onclick = () => {
        subscribe(0);
    }

    intern.onclick = () => {
        subscribe(1);
    }

    salesforce.onclick = () => {
        subscribe(2);
    }

    ap.onclick = () => {
        subscribe(3);
    }
}

addEventListener("DOMContentLoaded", begin);

const githubAuthProvider = new GithubAuthProvider();

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

// terminal screen
function loadTerminal() {
    const terminalScreen = document.getElementById("terminalScreen");

    // Predefined commands and responses
    const commands = {
        "gh auth login": "Authenticating... Please wait.",
        help: [
            "Available Commands:",
            "help",
            "exit",
            "gh auth login",

        ],
        exit: "Session terminated. Refresh to restart.",
    };

    // Append a new prompt to the terminal
    const appendPrompt = () => {
        const line = document.createElement("div");
        line.classList.add("line");

        const prompt = document.createElement("span");
        prompt.classList.add("prompt");
        prompt.textContent = "coder@2nddream ~ %";

        const input = document.createElement("input");
        input.classList.add("input");
        input.type = "text";
        input.autocomplete = "off";
        input.autofocus = true;

        line.appendChild(prompt);
        line.appendChild(input);
        terminalScreen.appendChild(line);

        // Focus on the new input
        input.focus();

        // Handle user input
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const command = input.value.trim();

                // Lock the input (make it read-only)
                input.setAttribute("readonly", "true");

                // Display the command in the terminal and handle it
                handleCommand(command);
            }
        });

        // Ensure the terminal scrolls to the bottom
        terminalScreen.scrollTop = terminalScreen.scrollHeight;
    };

    // Handle user commands
    const handleCommand = (command) => {
        let data = commands[command];
        if (data && data instanceof Array) {
            for (let j = 0; j < data.length; j++) {
                const response = createResponse(data[j]);
                terminalScreen.appendChild(response);
            }
        } else if (data) {
            const response = createResponse(data);
            terminalScreen.appendChild(response);
        } else {
            const response = createResponse(`Command not found: ${command}`);
            terminalScreen.appendChild(response);
        }

        // If the command is valid and requires the next step
        if (command === "gh auth login") {
            // login
            signInWithPopup(auth, githubAuthProvider)
                .then(async (result) => {
                    const user = result.user;
                    const additionalInfo = getAdditionalUserInfo(result);
                    if (additionalInfo.isNewUser) {
                        terminalScreen.appendChild(createResponse("Signing up " + user.displayName + "..."));
                    } else {
                        terminalScreen.appendChild(createResponse("Logging in " + user.displayName + "..."));
                    }
                })
                .catch((error) => {
                    console.error(error.message);
                });
        } else if (command !== "exit") {
            appendPrompt();
        }

        terminalScreen.scrollTop = terminalScreen.scrollHeight;
    };

    // Helper to create response lines
    const createResponse = (text) => {
        const response = document.createElement("div");
        response.textContent = text;
        response.classList.add("text-light");
        return response;
    };

    // Simulate installation process with progress bars
    const simulateInstallation = () => {
        const steps = [
            {text: "Downloading GitHub CLI...", duration: 1000},
            {text: "Extracting files...", duration: 1000},
            {text: "Installing dependencies...", duration: 1500},
            {text: "Setting up environment...", duration: 1000},
            {text: "Installation complete. Run 'gh auth login' to authenticate.", duration: 500},
        ];

        const addProgressBar = () => {
            const progressBarContainer = document.createElement("div");
            progressBarContainer.classList.add("progress", "mb-2");

            const progressBar = document.createElement("div");
            progressBar.classList.add("progress-bar");
            progressBar.style.width = "0%";

            progressBarContainer.appendChild(progressBar);
            terminalScreen.appendChild(progressBarContainer);

            return progressBar;
        };

        let index = 0;
        const processNextStep = () => {
            if (index < steps.length) {
                const step = steps[index];
                const response = createResponse(step.text);
                terminalScreen.appendChild(response);

                if (index < steps.length - 1) {
                    const progressBar = addProgressBar();
                    let progress = 0;

                    const interval = setInterval(() => {
                        progress += 20;
                        progressBar.style.width = `${progress}%`;

                        if (progress >= 100) {
                            clearInterval(interval);
                            terminalScreen.removeChild(progressBar.parentNode);
                            processNextStep();
                        }
                    }, step.duration / 5);
                } else {
                    setTimeout(() => {
                        processNextStep();
                    }, step.duration);
                }

                index++;
            } else {
                appendPrompt();
            }

            terminalScreen.scrollTop = terminalScreen.scrollHeight;
        };

        processNextStep();
    };

    // Initialize the terminal with installation process and prompt
    simulateInstallation();
}

function removeAllEventListeners(element) {
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    return newElement;
}

async function getBearerToken() {
    const user = auth.currentUser;

    if (!user) {
        throw new Error("User is not logged in");
    }

    return await user.getIdToken();
}

// config file register
function loadConfig() {
    const register = document.getElementById("register");

    const div = document.getElementById('editorTooltip');
    const tutorial = `
# Register Page
Fill out your data in the \`config.json\` file on the left and run the build script when you're finished!
                `
    div.innerHTML = marked(tutorial)

    // Generate line numbers dynamically based on the lines in the code block
    const lineNumberContainer = register.querySelector(".line-number-container");
    const codeBlock = register.querySelector(".code");
    const lines = codeBlock.innerText.split("\n");

    lineNumberContainer.innerHTML = lines
        .map((_, index) => `<div>${index + 1}</div>`)
        .join("");

    // Add event listeners to editable fields
    const editableFields = register.querySelectorAll(".editable");

    editableFields.forEach((field) => {
        // Prevent newline insertion
        field.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault(); // Stop the newline from being added
            }
        });

        const md = field.getAttribute("data-tooltip");
        if (md) {
            field.addEventListener("focus", (e) => {
                div.innerHTML = marked(md)
            });

            field.addEventListener("blur", (e) => {
                div.innerHTML = marked(tutorial)
            });
        }
    });

    const displayName = document.getElementById("configDisplayName");
    const email = document.getElementById("configEmail");
    const birthDate = document.getElementById("configBirthdate");
    const seeking = document.getElementById("configSeeking");
    const selfCapabilities = document.getElementById("configSelfCapabilites");
    const knownLangs = document.getElementById("configKnownLanguages");

    // add error for age (must be int)
    birthDate.addEventListener("input", () => {
        const value = birthDate.innerText;

        // Check if the value is in the right format
        if (/^\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{4})\s*$/.test(value)) {
            // Value contains only numbers
            birthDate.classList.remove("error");
        } else {
            // Value contains non-numeric characters
            birthDate.classList.add("error");
        }
    });

    const stackListener = (event) => {
        const value = event.target.innerText;

        if (value === "FULL_STACK" || value === "FRONT_END" || value === "BACK_END") {
            event.target.classList.remove("error");
        } else {
            event.target.classList.add("error");
        }
    }

    seeking.addEventListener("input", stackListener);
    selfCapabilities.addEventListener("input", stackListener);

    const supportedLangs = [ // if a list has more than one item, the following items are alternate names
        ["python"], ["c++", "cpp"], ["java"], ["javascript", "js"], ["kotlin"], ["ruby"], ["lua"], ["rust"], ["swift"],
        ["php"], ["go", "golang"], ["c#", "csharp"], ["sql"], ["css"], ["html"]
    ]

    function getLang(lang) {
        for (let i = 0; i < supportedLangs.length; i++) {
            let sLang = supportedLangs[i];
            if (sLang.includes(lang)) {
                return sLang[0];
            }
        }
        return null;
    }

    knownLangs.addEventListener("input", () => {
        const regex = /^\s*"([^"]+)"(?:\s*,\s*"([^"]+)")*\s*$/;
        const value = knownLangs.innerText;

        if (regex.test(value)) {
            knownLangs.classList.remove("error");
            // Extract the individual values
            const values = [...value.matchAll(/"([^"]+)"/g)].map(match => match[1]);
            for (let i = 0; i < values.length; i++) {
                const lang = getLang(values[i]);
                if (lang == null) {
                    knownLangs.classList.add("error");
                }
            }
        } else {
            knownLangs.classList.add("error");
        }
    });

    let run = document.getElementById("configRunButton");
    const consoleOutput = document.getElementById("configConsoleOutput");

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function displayOutput(text, del) {
        await delay(del);
        consoleOutput.innerHTML += text;
    }

    run = removeAllEventListeners(run);
    run.addEventListener("click", async (e) => {
        consoleOutput.innerHTML = "";
        await displayOutput("Running...<br><br>", 500);
        if (birthDate.classList.contains("error")) {
            await displayOutput(`
           <span style="color: red">Error:</span> invalid arguments for class Date(int, int, int)
           <br><br>
           Process failed with exit code 1.`, 500);
            return;
        } else {
            // check if month, day year format works
            const text = birthDate.innerText
            const result = text.split(",").map(item => item.trim());

            if (result[0] < 1 || result[0] > 12) {
                await displayOutput(`
               <span style="color: red">Error:</span> Argument 1 of class Date must be inclusive between 1 and 12
               <br><br>
               Process failed with exit code 1.
               `, 500)
                return;
            }
            if (result[1] < 1 || result[1] > 31) {
                await displayOutput(`
               <span style="color: red">Error:</span> Argument 2 of class Date must be inclusive between 1 and 31
               <br><br>
               Process failed with exit code 1.
               `, 500)
                return;
            }
        }

        if (selfCapabilities.classList.contains("error") || seeking.classList.contains("error")) {
            await displayOutput(`
           <span style="color: red">Error:</span> Invalid constant name for enum Stack
           <br><br>
           Process failed with exit code 1.
           `, 500);
            return;
        }

        if (knownLangs.classList.contains("error")) {
            await displayOutput(`
            <span style="color: red">Error:</span> known_languages cannot be empty or contain invalid items 
           <br><br>
           Process failed with exit code 1.
            `, 500);
            return;
        }

        if (displayName.innerText === "") {
            await displayOutput(`
            <span style="color: red">Error:</span> display_name cannot be empty
           <br><br>
           Process failed with exit code 1.
            `, 500);
            return
        }

        const user = auth.currentUser;

        updateProfile(user, {
            displayName: displayName.innerText
        });

        await displayOutput(`
           Process finished with exit code 0.
            `, 500);


        let stack = ["FRONT_END", "BACK_END", "FULL_STACK"]
        const values = [...knownLangs.innerText.matchAll(/"([^"]+)"/g)].map(match => match[1]);
        for (let i = 0; i < values.length; i++) {
            values[i] = getLang(values[i]);
        }

        // now create a profile in firestore

        // create a random value for selfCapabilities
        let maxSeed = Number.MAX_VALUE;
        let min = stack.indexOf(selfCapabilities.innerText)/3 * maxSeed;
        let max = (stack.indexOf(selfCapabilities.innerText) + 1)/3 * maxSeed;
        let random = Math.floor(Math.random() * (max - min + 1)) + min;

        const data = {
            displayName: displayName.innerText,
            bday: birthDate.innerText.trim().split(/,\s*/).map(num => num.trim()).map(Number),
            selfCapabilities: stack.indexOf(selfCapabilities.innerText),
            lookingFor: stack.indexOf(seeking.innerText),
            // FRONT_END seeds: 0 -> (1/3)maxSeed
            // BACK_END seeds: (1/3)Number.MAX_VALUE -> (2/3)maxSeed
            // FULL_STACK seeds: (3/3)Number.MAX_VALUE -> maxSeed
            matchSeed: random,
            knownLangs: values,
            pfpLink: user.providerData[0].photoURL,
            readme: "# Edit your README!"
        }

        const docRef = doc(db, "users", user.uid);
        setDoc(docRef, data)
            .then(() => {
                console.log('Document written with ID: ', docRef.id);
            })
            .catch((error) => {
                console.error('Error adding document: ', error);
            });

        const token = await getBearerToken();

        const response = await fetch('/api/register_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            window.alert("Failed to register user");
            throw new Error('Failed to register user');
        } else {
            viewingSelf = true;
            showPage(profilePage);
        }
    });
}

async function loadUsers() {
    const token = await getBearerToken();

    async function apiFetch() {
        const res = await fetch('/api/fetch_users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        return await res.json();
    }

    let lastFetch = localStorage.getItem("lastFetch");
    if (!lastFetch) { // user has never fetched; make an api call
        let res = await apiFetch();

        localStorage.setItem("lastFetch", (new Date()).toISOString());
        localStorage.setItem("matchpool", JSON.stringify(res.users));

        return res;
    }

    let limit = 0;
    switch (currentProfileData.membership) {
        case 0:
            limit = 604800; // 1 week in seconds
            break;
        // TODO: add other membership levels
    }

    lastFetch = new Date(lastFetch);
    let now = new Date();

    const timeDiff = now - lastFetch; // Difference in milliseconds
    let seconds = Math.floor(timeDiff / 1000);

    if (seconds > limit) { // return a new match pool with an api call
        let res = await apiFetch();

        localStorage.setItem("lastFetch", (new Date()).toISOString());
        localStorage.setItem("matchpool", JSON.stringify(res.users));

        return res;
    }

    // return cached data
    return {
        users: JSON.parse(localStorage.getItem("matchpool")),
        // 86400 seconds in a day
        message: `You have ${Math.floor((limit - seconds)/86400)} days left until you receive a new match pool`
    }
}

function createMatchpoolProfile(name, age, aura, rank, self, lookingFor, imgSrc, version) {
    // Create a div with the same structure as the provided profile template
    const profileDiv = document.createElement("div");
    profileDiv.className = "col-12 col-sm-3 profile"; // Ensures 4 per row

    if (version) {
        imgSrc += "?v=" + version;
    }

    profileDiv.innerHTML = `
        <div class="profile-left-container">
            <div class="profile-name-image mb-2 w-100">
                <img class="img-fluid rounded-top profile-pfp" src="${imgSrc}" alt="Profile Picture">
                <h1 class="rounded-bottom text-center profile-name">${name}</h1>
            </div>
            <hr>
            <div class="badge m-0 p-3 w-100">
                <div class="w-100 m-0 mb-2">
                    <span class="m-1 profile-age">Age: ${age}</span>
                    <span class="profile-aura">Aura: ${formatNumberWithUnits(aura)}🔥</span>
                </div>
                <span class="badge rank-jobless w-100">${rank}</span>
                <br>
                <span class="badge mt-1 profile-self"><i class="fa-solid fa-code"></i> ${self}</span>
                <span class="badge mt-1 profile-looking-for"><i class="fa-solid fa-magnifying-glass"></i> ${lookingFor}</span>
            </div>
            <hr>
            <button class="btn btn-primary">
                <i class="fa-solid fa-arrow-left"></i> Start Matching!
            </button>
        </div>
    `;

    // Append to the container
    document.getElementById("matchpool-container").appendChild(profileDiv);
}

async function showMatchPool() {
    // show a loading spinner
    let matchpoolContainer = document.getElementById("matchpool-container");
    matchpoolContainer.innerHTML = `
    <div class="d-flex justify-content-center">
        <div class="spinner-grow text-primary" style="width: 30rem; height: 30rem" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>
    `;
    let res = await loadUsers();
    console.log(res);
    matchpoolContainer.innerHTML = ""; // empty so we can append

    let users = res.users;
    let msg = res.message;

    let stack = ["Front End", "Back End", "Full Stack"];
    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        let bday = new Date(user.bday[2], user.bday[0] - 1, user.bday[1]); // Month is 0-based
        let ageDifMs = Date.now() - bday.getTime();
        let ageNum = Math.floor(ageDifMs / (1000 * 60 * 60 * 24 * 365.25)); // More accurate age calculation

        let auraNum = calculateAura(user.selfRequestedMatches, user.otherRequestedMatches, user.successfulMatches, user.selfCapabilities);

        // TODO: update rank
        createMatchpoolProfile(user.displayName, ageNum, auraNum, "Jobless", stack[user.selfCapabilities], stack[user.lookingFor], user.pfpLink, user.pfpVersion);
    }

    // TODO: stylised alert using `msg` variable
    if (msg) {
        setTimeout(() => alert(msg), 0);
    }
}

function loadProfilePage() {
    const profileEditReadme = document.getElementById("profile-edit-readme");
    const profileReadmeText = document.getElementById("profile-readme-text");
    const selfCapabilities = document.getElementById("profile-self");
    const seeking = document.getElementById("profile-looking-for");
    const pfp = document.getElementById("profile-pfp");
    const displayName = document.getElementById("profile-name");
    const subscription = document.getElementById("profile-rank");
    const leaveProfile = document.getElementById("profile-leave");

    // start matching if on our page
    leaveProfile.onclick = async (event) => {
        showPage(matchpoolPage);
    }

    // show subscriptions
    subscription.onclick = () => {
        const subModal = new bootstrap.Modal(document.getElementById("subscriptionModal"));
        subModal.show();
    }

    let stack = [" Front End", " Back End", " Full Stack"]; // space in front bc the element has a space after the font awesome

    let buttonPressed = false;
    selfCapabilities.onclick = (event) => {
        if (viewingSelf) {
            buttonPressed = true;
            let idx = stack.indexOf(selfCapabilities.innerText);
            idx++;
            if (idx > 2) {
                idx = 0;
            }
            selfCapabilities.innerHTML = "<i class=\"fa-solid fa-code\"></i> " + stack[idx];
        }
    }

    seeking.onclick = (event) => {
        if (viewingSelf) {
            buttonPressed = true;
            let idx = stack.indexOf(seeking.innerText);
            idx++;
            if (idx > 2) {
                idx = 0;
            }
            seeking.innerHTML = "<i class=\"fa-solid fa-magnifying-glass\"></i> " + stack[idx];
        }
    }

    const pfpConfirm = document.getElementById("pfp-save");
    const editPfpModal = new bootstrap.Modal(document.getElementById("pfpModal"));
    const fileInput = document.getElementById("pfp-file-input");
    const previewImage = document.getElementById("pfp-preview");
    let cropper;

    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImage.src = e.target.result;
                previewImage.style.display = "block";

                if (cropper) cropper.destroy(); // Destroy previous cropper instance
                cropper = new Cropper(previewImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1
                });
            };
            reader.readAsDataURL(file);
        }
    });

    pfpConfirm.onclick = async (event) => {
        if (cropper) {
            const croppedCanvas = cropper.getCroppedCanvas({
                width: 450, height: 450 // Adjust size as needed
            });
            croppedCanvas.toBlob(async (blob) => {
                if (blob.size <= 300 * 1024) { // 300KB limit
                    const fileExtension = blob.type.split("/")[1];
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = async function () {
                        const base64data = reader.result.split(",")[1];
                        console.log("File Extension:", fileExtension);
                        // send cropped image data to vercel function
                        const token = await getBearerToken();

                        const response = await fetch('/api/upload_pfp', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                fileExtension: fileExtension,
                                fileData: base64data,
                            })
                        });

                        let responseData = await response.json();

                        if (!currentProfileData.pfpVersion) {
                            currentProfileData.pfpVersion = 1;
                        } else {
                            currentProfileData.pfpVersion++;
                        }

                        currentProfileData.pfpLink = responseData.url + "?v=" + currentProfileData.pfpVersion;
                        pfp.src = responseData.url;

                        // update the current user's pfp in firebase
                        const docRef = doc(db, "users", auth.currentUser.uid);
                        await updateDoc(docRef, currentProfileData).then(() => {
                            console.log('Document was updated successfully.');
                        });

                        editPfpModal.hide();
                    };
                } else {
                    alert("Cropped image exceeds 300KB limit. Please crop further or choose another image.");
                }
            }, "image/webp", 0.8);
        }
    }

    pfp.onclick = (event) => {
        editPfpModal.show();
    }

    displayName.contentEditable = true;

    displayName.onblur = async (event) => {
        if (displayName.innerText !== "" && displayName.innerText !== currentProfileData.displayName) {
            const docRef = doc(db, "users", auth.currentUser.uid);
            currentProfileData.displayName = displayName.innerText;
            await updateDoc(docRef, currentProfileData).then(() => {
                console.log('Document was updated successfully.');
            });
        }
    }



    // only trigger an edit once the mouse leaves the edit box
    // TODO: live update aura
    const bounds = document.getElementById("profile-edit-bounds");
    bounds.onmouseout = async (event) => {
        if (buttonPressed) {
            buttonPressed = false;
            const docRef = doc(db, "users", auth.currentUser.uid);

            // create a random value for selfCapabilities
            let maxSeed = Number.MAX_VALUE;
            let min = stack.indexOf(selfCapabilities.innerText)/3 * maxSeed;
            let max = (stack.indexOf(selfCapabilities.innerText) + 1)/3 * maxSeed;
            let random = Math.floor(Math.random() * (max - min + 1)) + min;

            currentProfileData.selfCapabilities = stack.indexOf(selfCapabilities.innerText);
            currentProfileData.lookingFor = stack.indexOf(seeking.innerText);
            currentProfileData.matchSeed = random;
            await updateDoc(docRef, currentProfileData).then(() => {
                console.log('Document was updated successfully.');
            });
        }
    };

    profileEditReadme.onclick = async (event) => {
        if (profileEditReadme.classList.contains("fa-pencil-alt")) {
            // begin edit
            profileEditReadme.classList.remove("fa-pencil-alt");
            profileEditReadme.classList.add("fa-check");
            profileReadmeText.innerText = currentProfileData.readme;
            profileReadmeText.contentEditable = true;
        } else {
            // end edit
            profileEditReadme.classList.add("fa-pencil-alt");
            profileEditReadme.classList.remove("fa-check");

            currentProfileData.readme = profileReadmeText.innerText;

            const docRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(docRef, {readme: currentProfileData.readme})
                .then(() => {
                    console.log('Document written with ID: ', docRef.id);
                    profileReadmeText.innerHTML = marked(currentProfileData.readme, {gfm: true});
                    profileReadmeText.contentEditable = false;
                })
                .catch((error) => {
                    console.error('Error adding document: ', error);
                });
        }
    }
}

function subscribe(tier) {
    console.log("Subscribe " + tier);
}