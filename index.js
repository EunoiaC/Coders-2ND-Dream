import { marked } from "marked";

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
const registerPage = document.getElementById("register");

let pages = [loginPage, homePage, registerPage];

function showPage(page) {
    // hide all possible other pages
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.add("d-none");
    }

    page.classList.remove("d-none");
}

const githubAuthProvider = new firebase.auth.GithubAuthProvider();

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
            auth.signInWithPopup(githubAuthProvider)
                .then((result) => {
                    setTimeout(() => {
                    }, 2000); // 2 seconds delay
                    const user = result.user;
                    if (result.additionalUserInfo.isNewUser) {
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
            { text: "Downloading GitHub CLI...", duration: 1000 },
            { text: "Extracting files...", duration: 1000 },
            { text: "Installing dependencies...", duration: 1500 },
            { text: "Setting up environment...", duration: 1000 },
            { text: "Installation complete. Run 'gh auth login' to authenticate.", duration: 500 },
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

// config file register
function loadConfig() {
    const register = document.getElementById("register");

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
                const div = document.getElementById('editorTooltip');
                div.innerHTML = marked(md)
            });
        }
    });

    // fill known values
    const user = auth.currentUser;

    const displayName = document.getElementById("configDisplayName");
    const email = document.getElementById("configEmail");
    const age = document.getElementById("configAge");
    const seeking = document.getElementById("configSeeking");

    displayName.textContent = user.displayName;
    email.textContent = user.email;

    // add error for age (must be int)
    age.addEventListener("input", () => {
        const value = age.innerText;

        // Check if the value contains only numbers
        if (/^\d+$/.test(value)) {
            // Value contains only numbers
            age.classList.remove("error");
            console.log(`number only`);
        } else {
            // Value contains non-numeric characters
            age.classList.add("error");
        }
    });

    seeking.addEventListener("input", () => {
       const value = seeking.innerText;

       if (value === "FULL_STACK" || value === "FRONT_END" || value === "BACK_END") {
           seeking.classList.remove("error");
       } else {
           seeking.classList.add("error");
       }
    });
}

// which page to show user
auth.onAuthStateChanged(function(user) {
    if (user) {
        setTimeout(() => {
            showPage(registerPage);
            loadConfig(); // TODO: make specific for register
        }, 2000); // 2 seconds delay
    } else {
        // No user is signed in.
        showPage(loginPage);
        loadTerminal();
    }
});