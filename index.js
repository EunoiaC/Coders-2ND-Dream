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
import {doc, getDoc, getFirestore, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

// TODO: If users are experiencing bad performance or UI issues, check if it's due to adding listeners over and over
// TODO: free tier AI chat: https://chatgpt.com/share/679aa90e-f540-8007-8bf9-d87b7e36b6cc
// TODO: use a serverless function to make matches, check the user subscription level and info to stop inspect-elemented matches
// TODO: tally number of match requests/profile views, and lock an account if reaching membership limits. Set a timestamp, wait a week to unlock acc

// TODO: when plan changes, set lastFetch to null
// TODO: solve code together in chatrooms
// TODO: when opening a chatroom, the chatroom id will be {smallerUID}-{largerUID}
// TODO: chatroom home page styled as stackoverflow? https://stackoverflow.com/questions
//      - The chats will be listed as the stackoverflow questions page
//      - Questions will be how many messages the logged in user sent
//      - Answers will be how many messages the other user sent
//      - Views will be how many time each user opened the chat

// TODO: when a membership is upgraded, all chats need to have updated message limits

// TODO:
//  Add an incoming pull requests list with the UID of pending matches that can be rejected or accepted
//  - Users will have an "incomingRequests" and "outgoingRequests" field
//      - Sending a request will add the current user's "outgoingRequests"
//      - The receiving user will get the requesting user's uid added to "incomingRequests"
//      - The API will check if they have mutually requested each other before, and match if so
//  - Accepting a match leads to the creation of a chatroom stored in the openChats list in both user documents
//  - Need to create a "chats" collection where a chat can only be read by the two users, not written. Only server can write

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
const registerPage = document.getElementById("register");
const profilePage = document.getElementById("profile");
const matchpoolPage = document.getElementById("matchpool");
const chatsPage = document.getElementById("chats");

let pages = [loginPage, registerPage, profilePage, matchpoolPage, chatsPage];
let viewingSelf = false;
let currentProfileData = null;
let currentUserData = null;
let currentNotifIdx = 0;

// calculate aura
function calculateAura(selfRequestedMatches, otherRequestedMatches, successfulMatches, selfCapabilities, plan) {
    if (selfRequestedMatches < 0 || otherRequestedMatches < 0 || successfulMatches < 0) {
        throw new Error("Match values cannot be negative");
    }

    // Ensure plan is within range (0 to 3)
    plan = Math.max(0, Math.min(3, plan));

    // Base aura values for each plan
    const baseAuraValues = [100, 1000, 10000, 100000];
    let baseAura = baseAuraValues[plan];

    // Balanced request ratio (penalization less severe for higher plans)
    let requestRatio = (otherRequestedMatches + 1) / (selfRequestedMatches + 1); // Avoid division by zero
    let imbalanceFactor = 0.3 - (plan * 0.05); // Higher plans have reduced penalty
    let requestBalance = 200 / (1 + Math.exp(-imbalanceFactor * (requestRatio - 3))); // No penalty for moderate imbalance

    // Match success influence
    let matchFactor = successfulMatches / (selfRequestedMatches + otherRequestedMatches + 1);
    let matchScore = matchFactor * 300;

    // Capability Bonus (scaled instead of static)
    let capabilityBonus = (selfCapabilities + 1) * 75;

    // Final aura calculation
    let aura = (baseAura + requestBalance + matchScore) + capabilityBonus;

    return Math.max(Math.round(aura), 0); // Ensure aura is never negative
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

function calculateSuccessfulMatches(incoming, outgoing) {
    let successfulMatches = [];
    const set1 = new Set(incoming); // Convert first array to a Set for quick lookup
    outgoing.forEach(value => {
        if (set1.has(value)) {
            successfulMatches.push(value);
        }
    });
    return successfulMatches;
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
        profileEditReadme.classList.add("d-none"); // hide the edit button since viewing a different profile
        name.contentEditable = false;
        if (viewingSelf) {
            profileEditReadme.classList.remove("d-none");
            name.contentEditable = true;
        }

        // only read the current user's data unless user data is passed as an arg
        if (!data) {
            const docRef = doc(db, "users", auth.currentUser.uid);
            const docSnap = await getDoc(docRef);
            data = docSnap.data();
            currentUserData = data;
        }

        currentProfileData = data;

        const profileReadmeText = document.getElementById("profile-readme-text");

        const selfCapabilities = document.getElementById("profile-self");
        const customButton = document.getElementById("profile-custom-button");
        const lookingFor = document.getElementById("profile-looking-for");
        const profileRank = document.getElementById("profile-rank");
        profileRank.classList.remove("rank-jobless");
        profileRank.classList.remove("rank-intern");
        profileRank.classList.remove("rank-salesforceworker");
        profileRank.classList.remove("rank-apcsagod");

        const ranks = ["Jobless", "Intern", "Salesforce Worker", "AP CSA God"];
        const rankClasses = ["rank-jobless", "rank-intern", "rank-salesforceworker", "rank-apcsagod"];
        profileRank.innerText = ranks[data.membership];
        profileRank.classList.add(rankClasses[data.membership]);

        function renderCustomButton(type) {
            customButton.innerHTML = "";
            // reset custom button class list
            for (let i of customButton.classList) {
                if (!["btn", "w-100", "text-white"].includes(i)) {
                    customButton.classList.remove(i);
                }
            }

            if (type === "Github") {
                customButton.innerHTML = `
                <span class="me-auto">
                    <i class="bi bi-github"></i>
                </span>
                Github
                `;
                customButton.classList.add("btn-black");
            } else if (type === "Twitter") {
                customButton.innerHTML = `
                <span class="me-auto">
                    <i class="bi bi-twitter-x"></i>
                </span>
                Twitter
                `;
                customButton.classList.add("btn-black");
            } else if (type === "LinkedIn") {
                customButton.innerHTML = `
                <span class="me-auto">
                    <i class="bi bi-linkedin"></i>
                </span>
                LinkedIn
                `;
                customButton.classList.add("btn-linkedin");
            } else if (type === "Reddit") {
                customButton.innerHTML = `
                <span class="me-auto">
                    <i class="bi bi-reddit"></i>
                </span>
                Reddit
                `;
                customButton.classList.add("btn-reddit");
            }

            customButton.onclick = () => {
                if (!viewingSelf && customLink !== "") {
                    window.open(customLink, "_blank");
                } else {
                    // edit the custom button
                    customButtonModal.show();
                }
            }
        }

        let customLink = "";
        if (!data.customButton || data.customButton === "") {
            customButton.innerHTML = "No Custom Button";
            customButton.onclick = () => {}
            customButton.classList.add("btn-gray");
        } else {
            // split the custom button at the "\" character
            let split = data.customButton.split("\\");
            let type = split[0];
            customLink = split[1];
            renderCustomButton(type, customLink);
        }

        const customButtonModal = new bootstrap.Modal(document.getElementById("customButtonModal"));

        const customButtonForm = document.getElementById("socialLinkForm");
        customButtonForm.onsubmit = (event) => {
            event.preventDefault();
             // get form data
            console.log("customButtonForm submitted!");
            const type = document.getElementById("platformSelect");
            const link = document.getElementById("linkInput");

            const docRef = doc(db, "users", auth.currentUser.uid);
            // update the custom button in firestore
            updateDoc(docRef, {
                customButton: type.options[type.selectedIndex].text + "\\" + link.value
            }).then(() => {
                renderCustomButton(type.options[type.selectedIndex].text, link.value);
                customButtonModal.hide();
            }).catch((error) => {
                console.error("Error updating custom button: ", error);
            });
        }

        let stack = ["Front End", "Back End", "Full Stack"]

        selfCapabilities.innerHTML = "<i class=\"fa-solid fa-code\"></i> " + stack[data.selfCapabilities];
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

        // calculate successful matches (the amount of same values in both arrays)
        let successfulMatches = calculateSuccessfulMatches(data.incomingRequests, data.outgoingRequests);

        // TODO: add subscription level to aura
        let auraNum = calculateAura(data.outgoingRequests.length, data.incomingRequests.length, successfulMatches.length, data.selfCapabilities, data.membership);
        aura.innerText = "Aura: " + formatNumberWithUnits(auraNum) + "🔥";

        let knownLangs = data.knownLangs;
        let profileLanguages = document.getElementById("profile-languages");
        profileLanguages.innerHTML = "";
        for (let i = 0; i < knownLangs.length; i++) {
            let lang = knownLangs[i];
            if (lang === "c#") {
                lang = "csharp";
            }
            lang += "logo";
            if (lang === "csslogo") {
                lang += ".svg"
            } else {
                lang += ".png"
            }
            profileLanguages.innerHTML += `
            <img class="profile-lang-img" src="${lang}">
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
            currentUserData = docSnap.data();
            if (currentPage() === null) { // show page immediately
                showPage(profilePage, currentUserData);
            } else { // at login
                setTimeout(() => {
                    showPage(profilePage, currentUserData);
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
    loadMatchpool();
    loadChatPage();
    onAuthStateChanged(auth, authListener);
}

function loadChatPage() {
    const backBtn = document.getElementById("chats-back");
    backBtn.onclick = (event) => {
        showPage(matchpoolPage);
    }
}

function loadMatchpool() {
    const backBtn = document.getElementById("matchpool-back");
    backBtn.onclick = (event) => {
        showPage(profilePage, currentUserData);
    }
    const showChats = document.getElementById("matchpool-chats");
    showChats.onclick = (event) => {
        showPage(chatsPage, currentUserData);
    }
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

            // parse the birthday as a date, (-1 from date cuz date indexing starts at zero)
            let bday  = new Date(result[2], result[0]-1, result[1]);
            let diff = Date.now() - bday;
            const millisecondsInYear = 365.25 * 24 * 60 * 60 * 1000; // Account for leap years
            diff = diff / millisecondsInYear;

            if (diff < 13) {
                await displayOutput(`
               <span style="color: red">Error:</span> Birthday's Date field must be 13+ years ago
               <br><br>
               Process failed with exit code 1.
               `, 500)
                return;
            }

            // get difference in years

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

        let data = {
            displayName: displayName.innerText,
            bday: birthDate.innerText.trim().split(/,\s*/).map(num => num.trim()).map(Number),
            selfCapabilities: stack.indexOf(selfCapabilities.innerText),
            lookingFor: stack.indexOf(seeking.innerText),
            // FRONT_END seeds: 0 -> (1/3)maxSeed
            // BACK_END seeds: (1/3)Number.MAX_VALUE -> (2/3)maxSeed
            // FULL_STACK seeds: (3/3)Number.MAX_VALUE -> maxSeed
            matchSeed: random,
            knownLangs: values,
            pfpLink: user.providerData[0].photoURL
        }

        const token = await getBearerToken();

        const response = await fetch('/api/register_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            window.alert("Failed to register user");
            throw new Error('Failed to register user');
        } else {
            currentUserData = await response.json();
            viewingSelf = true;
            showPage(profilePage, currentUserData);
        }
    });
}

async function loadUsers(filter, lastDoc) {
    const token = await getBearerToken();

    async function apiFetch() {
        const res = await fetch('/api/fetch_users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                filter: filter,
                lastDoc: lastDoc,
            })
        });
        return await res.json();
    }

    let lastFetch = currentUserData.lastFetch;
    if (!lastFetch) { // user has never fetched; make an api call
        // for the current app session, just set last fetch to right now
        currentUserData.lastFetch = Timestamp.now();
        return await apiFetch();
    }

    let limit = 0;
    switch (currentUserData.membership) {
        case 0:
            limit = 604800; // 1 week in seconds
            break;
        // TODO: add other membership levels
    }

    lastFetch = lastFetch.toDate();
    let now = new Date();

    const timeDiff = now - lastFetch; // Difference in milliseconds
    let seconds = Math.floor(timeDiff / 1000);

    if (seconds > limit) { // return a new match pool with an api call
        console.log("fetching with api");
        return await apiFetch();
    }

    // return previous data
    return {
        users: currentUserData.matchpool,
        // 3600 seconds in an hour
        message: `You have ${Math.floor((limit - seconds)/3600)} hours left until you receive a new match pool.`
    }
}

function viewMatchpoolProfile(idx, data, scrollX, scrollY) {
    currentProfileData = data;
    viewingSelf = false;
    showPage(profilePage, currentProfileData);
    let match = document.getElementById("profile-match");
    let leave = document.getElementById("profile-leave");
    let logout = document.getElementById("profile-logout");
    logout.classList.add("d-none");
    match.classList.remove("d-none");
    leave.innerHTML = "<i class=\"fa-solid fa-arrow-left\"></i> Exit";

    match.onclick = async (event) => {
        let uid = null;
        if (currentUserData.membership === 3) {
            uid = data.uid;
        } else {
            uid = currentUserData.matchpool[idx];
        }
        console.log("attempting to match with " + uid);
        console.log("current outgoing requests: " + currentUserData.outgoingRequests);
        // check if the currentUser already sent an outgoing request
        const profileAlertContainer = document.getElementById("profile-alerts");
        for (let i = 0; i < currentUserData.outgoingRequests.length; i++) {
            if (currentUserData.outgoingRequests[i] === uid) { // the logged in user already tried matching with this user
                // show an error
                profileAlertContainer.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    You have already tried pulling this user.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
                `
                return;
            }
        }

        // send a match req
        let oldInnerHtml = match.innerHTML; // show a spinner
        match.innerHTML = `
        <div class="spinner-border spinner-border-sm" role="status">
          <span class="sr-only">Loading...</span>
        </div>
        `;

        const token = await getBearerToken();

        const response = await fetch('/api/request_match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                desiredMatchUID: uid,
            })
        });

        match.innerHTML = oldInnerHtml; // close the spinner

        // TODO: add special alert on chatroom creation

        if (response.ok) {
            currentUserData.outgoingRequests.push(uid);

            let result = await response.json();
            if (result.chatroom) {
                profileAlertContainer.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show" id="match-alert" role="alert">
                    Chat thread created from mutual pull requests!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
                `;
            } else {
                // show success
                profileAlertContainer.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show" id="match-alert" role="alert">
                    Pull request successfully sent!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
                `;
            }
        } else {
            profileAlertContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" id="match-alert" role="alert">
                Error with server.
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
            `
        }

        // let result = await response.json();
    }

    leave.onclick = (event) => {
        // hide the match alert
        let alert = document.getElementById("match-alert");
        if (alert) { // only if it was created
            alert.remove();
        }
        leave.innerHTML = `<i class="fa-solid fa-arrow-left"></i> Match`;
        match.classList.add("d-none");
        logout.classList.remove("d-none");
        currentProfileData = currentUserData;
        viewingSelf = true;
        showPage(matchpoolPage);
        // scroll to the previous position
        window.scrollTo({
            top: scrollY,
            left: scrollX,
            behavior: 'smooth' // Adds a smooth scrolling animation
        });

        // set the leave onclick listener
        leave.onclick = (event) => {
            showPage(matchpoolPage);
        }
    }
}

function createMatchpoolProfile(name, age, aura, rank, self, lookingFor, imgSrc, version, idx, data) {
    // Create a div with the same structure as the provided profile template
    const profileDiv = document.createElement("div");
    profileDiv.className = "col-12 col-sm-3 profile"; // Ensures 4 per row

    if (version) {
        imgSrc += "?v=" + version;
    }

    const ranks = ["Jobless", "Intern", "Salesforce Worker", "AP CSA God"];
    const rankClasses = ["rank-jobless", "rank-intern", "rank-salesforceworker", "rank-apcsagod"];
    let rankText = ranks[rank];
    let rankClass = rankClasses[rank];

    let pfpOverlay = `
    <p class="pfp-hover-text">You must have a subscription of <span class="text-primary">Salesforce Worker</span> or <span class="text-warning">AP CSA God</span> to view profile insights.</p>
    `;
    if (currentUserData.membership > 1) {
        // pfp overlay is a loader with the text Loading Insights...
        pfpOverlay = `
        <div class="col">
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading insights...</span>
            </div>
            <span>Loading insights...</span>
        </div>
        `;
    }

    profileDiv.innerHTML = `
        <div class="profile-left-container">
            <div class="profile-name-image mb-2 w-100">
                <div class="pfp-hover-container ">
                    <img class="img-fluid rounded-top profile-pfp" src="${imgSrc}" alt="Profile Picture">
                    <div class="pfp-overlay" id="pfp-insight-${idx}">
                        ${pfpOverlay}
                    </div>
                </div>
                <h1 class="rounded-bottom text-center profile-name">${name}</h1>
            </div>
            <hr>
            <div class="badge m-0 p-3 w-100">
                <div class="w-100 m-0 mb-2">
                    <span class="m-1 profile-age">Age: ${age}</span>
                    <span class="profile-aura">Aura: ${formatNumberWithUnits(aura)}🔥</span>
                </div>
                <span class="badge ${rankClass} w-100">${rankText}</span>
                <br class="removable">
                <span class="badge mt-1 profile-self"><i class="fa-solid fa-code"></i> ${self}</span>
                <span class="badge mt-1 profile-looking-for"><i class="fa-solid fa-magnifying-glass"></i> ${lookingFor}</span>
            </div>
            <hr>
            <button class="btn btn-primary" id="view-matchpool-${idx}">
                <i class="fa-regular fa-user"></i> View
            </button>
        </div>
    `;

    // Append to the container
    document.getElementById("matchpool-container").appendChild(profileDiv);

    let viewProfile = document.getElementById(`view-matchpool-${idx}`);
    viewProfile.onclick = (e) => {
        viewMatchpoolProfile(idx, data, window.scrollX, window.scrollY);
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth' // Adds a smooth scrolling animation
        });
    }
}

let loadedMatches = false;

async function renderNotifs(items) {
    const notifContainer = document.getElementById("matchpool-notifications");
    // TODO: store rejected users in localstorage with key "rejected-{loggedIn.UID}"

    for (let i = items.length - 1; i >= 0; i--) {
        // check if the item has a dash
        if (items[i].includes("-")) {
        } else {
            let docRef = doc(db, "users", items[i]);
            let user = (await getDoc(docRef)).data();
            let pfpLink = user.pfpLink;
            if (user.pfpVersion) {
                pfpLink += "?v=" + user.pfpVersion;
            }

            let bday = new Date(user.bday[2], user.bday[0] - 1, user.bday[1]); // Month is 0-based
            let ageDifMs = Date.now() - bday.getTime();
            let ageNum = Math.floor(ageDifMs / (1000 * 60 * 60 * 24 * 365.25)); // More accurate age calculation

            notifContainer.innerHTML += `
                <div class="badge w-100 card bg-dark text-white p-2 mb-2">
                    <div class="d-flex justify-content-between mt-1">
                        <div class="d-flex align-items-center">
                            <img src="${pfpLink}" class="img-fluid rounded me-2" style="width: 50px; height: 50px" alt="Profile">
                            <h6 class="mb-0">${user.displayName} (${ageNum})</h6>
                        </div>
                    </div>
                    <div class="d-flex gap-2 align-items-center mt-1">
                        <button class="btn btn-sm btn-primary w-100">View</button>
                    </div>
                </div>
                `;
        }
    }
}

async function showMatchPool() {
    // hide alert
    const repeatAlert = document.getElementById("alert-repeat-match");
    try{
        repeatAlert.classList.add("d-none");
    } catch(error) {}
    let matchpoolContainer = document.getElementById("matchpool-container");
    // show a loading spinner only if the container is unpopulated
    if (!loadedMatches) {
        matchpoolContainer.innerHTML = `
        <div class="d-flex justify-content-center">
            <div class="spinner-grow text-primary" style="width: 30rem; height: 30rem" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        `;
    }

    let res = null;
    if (currentUserData.membership === 3) {
        if (loadedMatches) {
            return; // don't refresh the animation
        }
        res = await loadUsers(null, null);
    }
    else {
        res = await loadUsers(null, null);
    }
    // set currentUserData's matchpool to users, since we are either updating or creating a matchpool
    if (res.users) {
        currentUserData.matchpool = res.users;
    }

    console.log(res);

    let users = res.users;
    let msg = res.message;
    // TODO: stylised alert using `msg` variable
    if (msg) {
        try{
            repeatAlert.classList.remove("d-none");
            const text = document.getElementById("matchpool-reset-text");
            text.innerText = msg;
        } catch(error) {}
        if (loadedMatches) { // if we have loaded the users already AND there is a message (means no update), we can return
            return;
        }
    }

    let len = 0;
    // in case a plan doesn't return users:
    if (res.loadedData) {
        len = res.loadedData.length;
    } else {
        len = users.length;
    }

    let imageUrls = [];

    loadedMatches = true;
    matchpoolContainer.innerHTML = ""; // empty so we can append
    let stack = ["Front End", "Back End", "Full Stack"];
    for (let i = 0; i < len; i++) {
        let user = null;
        if (res.loadedData) {
            user = res.loadedData[i];
        } else {
            let docRef = doc(db, "users", users[i]);
            user = (await getDoc(docRef)).data();
        }

        let bday = new Date(user.bday[2], user.bday[0] - 1, user.bday[1]); // Month is 0-based
        let ageDifMs = Date.now() - bday.getTime();
        let ageNum = Math.floor(ageDifMs / (1000 * 60 * 60 * 24 * 365.25)); // More accurate age calculation

        let successfulMatches = calculateSuccessfulMatches(user.incomingRequests, user.outgoingRequests);
        let auraNum = calculateAura(user.outgoingRequests.length, user.incomingRequests.length, successfulMatches.length, user.selfCapabilities, user.membership);

        // TODO: update rank
        // TODO: if subscription allows, generate insights for each users and add an additional "insight" field for each user
        createMatchpoolProfile(user.displayName, ageNum, auraNum, user.membership, stack[user.selfCapabilities], stack[user.lookingFor], user.pfpLink, user.pfpVersion, i, user);

        imageUrls.push(user.pfpLink);
    }

    // add the cards animation
    const cardContainer = document.getElementById("matchpool-container");
    const cards = cardContainer.querySelectorAll(".profile");

    // Trigger the animation
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add("animate");
        }, index * 100); // Delay each card by 100ms
    });

    const btn = document.getElementById("matchpool-notif-btn");
    const showMoreBtn = document.getElementById("matchpool-notifications-show-more");

    // subtract already viewed users from the notification count
    let alreadySeen = JSON.parse(localStorage.getItem("seen-users-" + auth.currentUser.uid));
    if (!alreadySeen) {
        alreadySeen = [];
    }
    const notifBadge = document.getElementById("notif-badge");
    // remove similar items from incoming requests and alreadySeen
    let newUsers = currentUserData.incomingRequests.filter(x => !alreadySeen.includes(x));
    if (newUsers.length > 0) {
        notifBadge.classList.remove("d-none");
        notifBadge.innerText = newUsers.length;
    }

    btn.onclick = async (e) => {
        // load the incoming requests, with labels indicating new requests
        if (currentNotifIdx === 0) {
            // set the limit to 5, or whatever the length of the incoming requests is if less than 5
            currentNotifIdx = 5;
            if (currentUserData.incomingRequests.length < 5) {
                currentNotifIdx = currentUserData.incomingRequests.length;
            }
            users = currentUserData.incomingRequests.slice(-currentNotifIdx);
            // add these seen users to local storage
            let alreadySeen = JSON.parse(localStorage.getItem("seen-users-" + auth.currentUser.uid));
            // add the users to alreadySeen
            if (!alreadySeen) {
                alreadySeen = [];
            }
            for (let i = 0; i < users.length; i++) {
                if (!alreadySeen.includes(users[i])) {
                    alreadySeen.push(users[i]);
                }
            }
            localStorage.setItem("seen-users-" + auth.currentUser.uid, JSON.stringify(alreadySeen));
            await renderNotifs(users);
        }
    }

    showMoreBtn.onclick = () => {
        // show more notifications
        let oldIdx = currentNotifIdx;
        if (currentNotifIdx + 5 > currentUserData.incomingRequests.length) {
            currentNotifIdx = currentUserData.incomingRequests.length;
        } else {
            currentNotifIdx += 5;
        }
        users = currentUserData.incomingRequests.slice(-currentNotifIdx, -oldIdx);
        // add these seen users to local storage
        let alreadySeen = JSON.parse(localStorage.getItem("seen-users-" + auth.currentUser.uid));
        // add the users to alreadySeen
        if (!alreadySeen) {
            alreadySeen = [];
        }
        for (let i = 0; i < users.length; i++) {
            if (!alreadySeen.includes(users[i])) {
                alreadySeen.push(users[i]);
            }
        }
        localStorage.setItem("seen-users-" + auth.currentUser.uid, JSON.stringify(alreadySeen));
        // render the new users
        renderNotifs(users);
        if (currentNotifIdx === currentUserData.incomingRequests.length) {
            showMoreBtn.classList.add("d-none");
        }
    }

    // load insights in the background
    if (currentUserData.membership > 1) {
        // TODO: fetch insights and add them to a profile element named "pfp-insight-idx"
        const token = await getBearerToken();

        const response = await fetch('/api/fetch_insight', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                imageUrls: imageUrls,
            })
        });

        if (response.ok) {
            let result = await response.json();
            let insights = result.insights;
            // insights is a json but as a string, convert it to a json
            insights = JSON.parse(insights);
            insights = insights.insights;
            for (let i = 0; i < insights.length; i++) {
                let insightList = insights[i].insights;
                const insightContainer = document.getElementById("pfp-insight-" + i);
                let innerHTML = '<p class="pfp-hover-text text-start">';
                for (let j = 0; j < insightList.length; j++) {
                    // split the insight at the ':'
                    let insight = insightList[j];
                    insight = insight.split(":");
                    innerHTML += '<span class="fw-bold">' + insight[0] + ":</span> " + insight[1] + "<br>";
                }
                innerHTML += `</p>`;
                insightContainer.innerHTML = innerHTML;
            }
        }
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
    const logout = document.getElementById("profile-logout");
    const confirmLogout = document.getElementById("confirmLogout");
    const logoutModal = new bootstrap.Modal(document.getElementById("logoutModal")); // Create once

    logout.onclick = (e) => {
        logoutModal.show();
    }

    confirmLogout.onclick = (e) => {
        logoutModal.hide();
        signOut();
    }

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

                        if (!currentUserData.pfpVersion) {
                            currentUserData.pfpVersion = 1;
                        } else {
                            currentUserData.pfpVersion++;
                        }

                        currentUserData.pfpLink = responseData.url + "?v=" + currentUserData.pfpVersion;
                        pfp.src = currentUserData.pfpLink;

                        // update the current user's pfp in firebase
                        const docRef = doc(db, "users", auth.currentUser.uid);
                        await updateDoc(docRef, {
                            pfpLink: responseData.url,
                            pfpVersion: currentUserData.pfpVersion
                        }).then(() => {
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
        if (viewingSelf) {
            editPfpModal.show();
        }
    }

    displayName.onblur = async (event) => {
        if (displayName.innerText !== "" && displayName.innerText !== currentUserData.displayName) {
            const docRef = doc(db, "users", auth.currentUser.uid);
            currentUserData.displayName = displayName.innerText;
            await updateDoc(docRef, {
                displayName: currentUserData.displayName
            }).then(() => {
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

            currentUserData.selfCapabilities = stack.indexOf(selfCapabilities.innerText);
            currentUserData.lookingFor = stack.indexOf(seeking.innerText);
            currentUserData.matchSeed = random;
            await updateDoc(docRef, {
                selfCapabilities: currentUserData.selfCapabilities,
                lookingFor: currentUserData.lookingFor,
                matchSeed: currentUserData.matchSeed
            }).then(() => {
                console.log('Document was updated successfully.');
            });
        }
    };

    profileEditReadme.onclick = async (event) => {
        if (profileEditReadme.classList.contains("fa-pencil-alt")) {
            // begin edit
            profileEditReadme.classList.remove("fa-pencil-alt");
            profileEditReadme.classList.add("fa-check");
            profileReadmeText.innerText = currentUserData.readme;
            profileReadmeText.contentEditable = true;
        } else {
            // end edit
            profileEditReadme.classList.add("fa-pencil-alt");
            profileEditReadme.classList.remove("fa-check");

            currentUserData.readme = profileReadmeText.innerText;

            const docRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(docRef, {readme: currentUserData.readme})
                .then(() => {
                    console.log('Document written with ID: ', docRef.id);
                    profileReadmeText.innerHTML = marked(currentUserData.readme, {gfm: true});
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