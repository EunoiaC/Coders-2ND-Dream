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
import {doc, getDoc, setDoc, updateDoc, getFirestore} from 'firebase/firestore';

// TODO: If users are experiencing bad performance or UI issues, check if it's due to adding listeners over and over
// TODO: free tier AI chat: https://chatgpt.com/share/679aa90e-f540-8007-8bf9-d87b7e36b6cc
// TODO: use a serverless function to make matches, check the user subscription level and info to stop inspect-elemented matches
// TODO: tally number of match requests/profile views, and lock an account if reaching membership limits. Set a timestamp, wait a week to unlock acc

/* TODO: the following code for checking if account cooldown is over
import { serverTimestamp } from "firebase/firestore";
const updateTimestamp = await updateDoc(docRef, {
    timestamp: serverTimestamp()
});
 */

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

let pages = [loginPage, homePage, registerPage, profilePage];
let currentProfileUID = null;
let currentProfileData = null

async function showPage(page) {
    // hide all possible other pages
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.add("d-none");
    }

    page.classList.remove("d-none");

    if (page === registerPage) {
        // clear the config console
        const console = document.getElementById("configConsoleOutput");
        console.innerText = ""
    } else if (page === profilePage) {
        const pfp = document.getElementById("profile-pfp");
        const name = document.getElementById("profile-name");
        const age = document.getElementById("profile-age");
        const aura = document.getElementById("profile-aura");
        const docRef = doc(db, "users", currentProfileUID);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        currentProfileData = data

        const profileEditReadme = document.getElementById("profile-edit-readme");
        const profileReadmeText = document.getElementById("profile-readme-text");

        const selfCapabilities = document.getElementById("profile-self");
        const langTitle = document.getElementById("profile-self-lang");
        const lookingFor = document.getElementById("profile-looking-for");

        let stack = ["Front End", "Back End", "Full Stack"]

        selfCapabilities.innerHTML = "<i class=\"fa-solid fa-code\"></i> " + stack[data.selfCapabilities];
        langTitle.innerHTML = "<i class=\"fa-solid fa-code\"></i> " + stack[data.selfCapabilities];
        lookingFor.innerHTML = "<i class=\"fa-solid fa-magnifying-glass\"></i> " + stack[data.lookingFor];

        profileReadmeText.innerHTML = marked(data.readme, {gfm: true});
        pfp.src = data.pfpLink;

        let bday = new Date(data.bday[2] + "-" + data.bday[0] + "-" + data.bday[1]);
        let ageDifMs = Date.now() - bday.getTime();
        let ageDate = new Date(ageDifMs); // miliseconds from epoch
        let ageNum = Math.abs(ageDate.getUTCFullYear() - 1970);

        name.textContent = data.displayName;
        age.textContent = "Age: " + ageNum;

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

        // TODO: add subscription level to aura
        let auraNum = calculateAura(data.selfRequestedMatches, data.otherRequestedMatches, data.successfulMatches, data.selfCapabilities);
        aura.innerText = "Aura: " + formatNumberWithUnits(auraNum) + "🔥";



        if (currentProfileUID === auth.currentUser.uid) {
            profileEditReadme.classList.remove("d-none");
        } else {
            profileEditReadme.classList.add("d-none");
        }

        let knownLangs = data.knownLangs;
        let profileLanguages = document.getElementById("profile-languages");
        profileLanguages.innerHTML = "";
        for (let i = 0; i < knownLangs.length; i++) {
            let lang = knownLangs[i];
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

        dname.innerText = user.displayName;
        email.innerText = user.email;

        currentProfileUID = user.uid;

        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) { // registered user
            const data = docSnap.data();
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
    onAuthStateChanged(auth, authListener);
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
        field.addEventListener("input", () => {
            // Example: validate or store field data in real-time
            console.log(`${field.dataset.key || "field"} updated: ${field.innerText}`);
        });

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
                console.log(lang);
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
        const data = {
            displayName: displayName.innerText,
            bday: birthDate.innerText.trim().split(/,\s*/).map(num => num.trim()).map(Number),
            selfCapabilities: stack.indexOf(selfCapabilities.innerText),
            lookingFor: stack.indexOf(seeking.innerText),
            knownLangs: values,
            pfpLink: user.providerData[0].photoURL,
            readme: "# Edit your README!"
        }
        console.log(data)

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
            showPage(profilePage);
        }
    });
}

function loadProfilePage() {
    const profileEditReadme = document.getElementById("profile-edit-readme");
    const profileReadmeText = document.getElementById("profile-readme-text");

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