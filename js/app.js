// http://127.0.0.1:3000/index.html
const r = document.querySelector(':root');
const onOff = document.getElementById('audio');
const icon = document.querySelector('.fa-volume-high');
const saveButton = document.getElementById('save');
const buttonOne = document.getElementById('one');
const buttonTwo = document.getElementById('two');
const buttonThree = document.getElementById('three');
const buttonFour = document.getElementById('four');
const buttonFive = document.getElementById('five');

let num = 0;
let toggleOne = 0;
let toggleTwo = 0;
let toggleThree = 0;
let toggleFour = 0;
let toggleFive = 0;

let myLocalParams = [];
let theParams = [
    { // botón 1
        'density': 20,
        'grain_size': 311.8,
        'pitch': 0.6,
        'position': 0.08,
        'spray': 0.01,
        'spread':0.442,
        'stereo_spread': 0.16
    },
    { // botón 2
        'density': 8,
        'grain_size': 144.8,
        'pitch': -34,
        'position': 0.08,
        'spray': 0.01,
        'spread':0.442,
        'stereo_spread': 0.15
    },
    { // botón 3
        'density': 55,
        'grain_size': 200,
        'pitch': 34,
        'position': 0.08,
        'spray': 0.01,
        'spread':0.442,
        'stereo_spread': 0.14
    },
    { // botón 4
        'density': 89,
        'grain_size': 400,
        'pitch': -13,
        'position': 0.08,
        'spray': 0.01,
        'spread':0.442,
        'stereo_spread': 0.13
    },
    { // botón 5
        'density': 5,
        'grain_size': 144,
        'pitch': 21,
        'position': 0.08,
        'spray': 0.01,
        'spread':0.442,
        'stereo_spread': 0.12
    }
];

// local storage functionality
document.addEventListener('DOMContentLoaded', () => {
    displayLocalStorageParams();
})

const displayLocalStorageParams = () => {
    myLocalParams = JSON.parse(localStorage.getItem('theParams'));

    for (let i = 0; i < theParams.length; i++) {
        theParams[i].density = myLocalParams[i].density;
        theParams[i].grain_size = myLocalParams[i].grain_size;
        theParams[i].pitch = myLocalParams[i].pitch;
        theParams[i].position = myLocalParams[i].position;
        theParams[i].spray = myLocalParams[i].spray;
        theParams[i].spread = myLocalParams[i].spread;
        theParams[i].stereo_spread = myLocalParams[i].stereo_spread;
    }
}

const myLocalStorageParams = () => {
    localStorage.setItem('theParams', JSON.stringify(theParams));
}

// audio context setup
async function setup() {
    const patchExportURL = "export/patch.export.json";

    // Create AudioContext
    const WAContext = window.AudioContext || window.webkitAudioContext;
    const context = new WAContext();

    // Create gain node and connect it to audio output
    const outputNode = context.createGain();
    outputNode.connect(context.destination);

    // Fetch the exported patcher
    let response, patcher;
    try {
        response = await fetch(patchExportURL);
        patcher = await response.json();

        if (!window.RNBO) {
            // Load RNBO script dynamically
            // Note that you can skip this by knowing the RNBO version of your patch
            // beforehand and just include it using a <script> tag
            await loadRNBOScript(patcher.desc.meta.rnboversion);
        }

    } catch (err) {
        const errorContext = {
            error: err
        };
        if (response && (response.status >= 300 || response.status < 200)) {
            errorContext.header = `Couldn't load patcher export bundle`,
            errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
            ` trying to load "${patchExportURL}". If that doesn't` +
            ` match the name of the file you exported from RNBO, modify` +
            ` patchExportURL in app.js.`;
        }
        if (typeof guardrails === "function") {
            guardrails(errorContext);
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Fetch the dependencies
    let dependencies = [];
    try {
        const dependenciesResponse = await fetch("export/dependencies.json");
        dependencies = await dependenciesResponse.json();

        // Prepend "export" to any file dependenciies
        dependencies = dependencies.map(d => d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d);
    } catch (e) {}

    // Create the device
    let device;
    try {
        device = await RNBO.createDevice({ context, patcher });
    } catch (err) {
        if (typeof guardrails === "function") {
            guardrails({ error: err });
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Load the samples
    if (dependencies.length)
        await device.loadDataBufferDependencies(dependencies);

    // Connect the device to the web audio graph
    device.node.connect(outputNode);

    // (Optional) Automatically create sliders for the device parameters
    makeSliders(device);

    // BOTONES
    buttonsParams(device);

    // GUARDAR LS
    saveLocalStorage(device);

    onOff.onclick = () => {
        if (num == 0) {
            context.resume();
            num = 1;
            icon.classList.remove('fa-volume-high');
            icon.classList.add('fa-volume-xmark');
            r.style.setProperty('--fondo', '#000');
            r.style.setProperty('--lineas', '#FFF');
        } else if (num == 1) {
            context.suspend();
            num = 0;
            icon.classList.remove('fa-volume-xmark');
            icon.classList.add('fa-volume-high');
            r.style.setProperty('--fondo', '#FFF');
            r.style.setProperty('--lineas', '#000');
        }
    }

    // Skip if you're not using guardrails.js
    if (typeof guardrails === "function")
        guardrails();
}

function loadRNBOScript(version) {
    return new Promise((resolve, reject) => {
        if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
            throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
        }
        const el = document.createElement("script");
        el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load rnbo.js v" + version));
        };
        document.body.append(el);
    });
}

function makeSliders(device) {
    let pdiv = document.getElementById("rnbo-parameter-sliders");
    let noParamLabel = document.getElementById("no-param-label");
    if (noParamLabel && device.numParameters > 0) pdiv.removeChild(noParamLabel);

    // This will allow us to ignore parameter update events while dragging the slider.
    let isDraggingSlider = false;
    let uiElements = {};

    device.parameters.forEach(param => {
        // Subpatchers also have params. If we want to expose top-level
        // params only, the best way to determine if a parameter is top level
        // or not is to exclude parameters with a '/' in them.
        // You can uncomment the following line if you don't want to include subpatcher params

        //if (param.id.includes("/")) return;

        // Create a label, an input slider and a value display
        // let label = document.createElement("label");
        let slider = document.createElement("input");
        let text = document.createElement("input");
        let sliderContainer = document.createElement("div");
        //sliderContainer.appendChild(label);
        sliderContainer.appendChild(slider);
        //sliderContainer.appendChild(text);

        // Add a name for the label
        /*
        label.setAttribute("name", param.name);
        label.setAttribute("for", param.name);
        label.setAttribute("class", "param-label");
        label.textContent = `${param.name}: `;
        */

        // Make each slider reflect its parameter
        slider.setAttribute("type", "range");
        slider.setAttribute("class", "param-slider");
        slider.setAttribute("id", param.id);
        slider.setAttribute("name", param.name);
        slider.setAttribute("min", param.min);
        slider.setAttribute("max", param.max);
        if (param.steps > 1) {
            slider.setAttribute("step", (param.max - param.min) / (param.steps - 1));
        } else {
            slider.setAttribute("step", (param.max - param.min) / 1000.0);
        }
        slider.setAttribute("value", param.value);

        // Make a settable text input display for the value
        /*
        text.setAttribute("value", param.value.toFixed(1));
        text.setAttribute("type", "text");
        */

        // Make each slider control its parameter
        slider.addEventListener("pointerdown", () => {
            isDraggingSlider = true;
        });
        slider.addEventListener("pointerup", () => {
            isDraggingSlider = false;
            slider.value = param.value;
            text.value = param.value.toFixed(3);
        });
        slider.addEventListener("input", () => {
            let value = Number.parseFloat(slider.value);
            param.value = value;
        });

        // Make the text box input control the parameter value as well
        /*
        text.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                let newValue = Number.parseFloat(text.value);
                if (isNaN(newValue)) {
                    text.value = param.value;
                } else {
                    newValue = Math.min(newValue, param.max);
                    newValue = Math.max(newValue, param.min);
                    text.value = newValue;
                    param.value = newValue;
                }
            }
        });
        */

        // Store the slider and text by name so we can access them later
        uiElements[param.id] = { slider, text };

        // Add the slider element
        pdiv.appendChild(sliderContainer);
    });

    // Listen to parameter changes from the device
    device.parameterChangeEvent.subscribe(param => {
        if (!isDraggingSlider)
            uiElements[param.id].slider.value = param.value;
        uiElements[param.id].text.value = param.value.toFixed(3);
    });
}

// GUARDAR LS
const saveLocalStorage = (device) => {
    saveButton.addEventListener('click', () => {
        saveButton.classList.add('selected');

        if (toggleOne == 1) {
            theParams[0].density = device.parameters[0].value;
            theParams[0].grain_size = device.parameters[1].value;
            theParams[0].pitch = device.parameters[2].value;
            theParams[0].position = device.parameters[3].value;
            theParams[0].spray = device.parameters[4].value;
            theParams[0].spread = device.parameters[5].value;
            theParams[0].stereo_spread = device.parameters[6].value;

            myLocalStorageParams();
        } else if (toggleTwo == 1) {
            theParams[1].density = device.parameters[0].value;
            theParams[1].grain_size = device.parameters[1].value;
            theParams[1].pitch = device.parameters[2].value;
            theParams[1].position = device.parameters[3].value;
            theParams[1].spray = device.parameters[4].value;
            theParams[1].spread = device.parameters[5].value;
            theParams[1].stereo_spread = device.parameters[6].value;

            myLocalStorageParams();
        } else if (toggleThree == 1) {
            theParams[2].density = device.parameters[0].value;
            theParams[2].grain_size = device.parameters[1].value;
            theParams[2].pitch = device.parameters[2].value;
            theParams[2].position = device.parameters[3].value;
            theParams[2].spray = device.parameters[4].value;
            theParams[2].spread = device.parameters[5].value;
            theParams[2].stereo_spread = device.parameters[6].value;

            myLocalStorageParams();
        } else if (toggleFour == 1) {
            theParams[3].density = device.parameters[0].value;
            theParams[3].grain_size = device.parameters[1].value;
            theParams[3].pitch = device.parameters[2].value;
            theParams[3].position = device.parameters[3].value;
            theParams[3].spray = device.parameters[4].value;
            theParams[3].spread = device.parameters[5].value;
            theParams[3].stereo_spread = device.parameters[6].value;

            myLocalStorageParams();
        } else if (toggleFive == 1) {
            theParams[4].density = device.parameters[0].value;
            theParams[4].grain_size = device.parameters[1].value;
            theParams[4].pitch = device.parameters[2].value;
            theParams[4].position = device.parameters[3].value;
            theParams[4].spray = device.parameters[4].value;
            theParams[4].spread = device.parameters[5].value;
            theParams[4].stereo_spread = device.parameters[6].value;

            myLocalStorageParams();
        }

        setTimeout(() => {
            saveButton.classList.remove('selected');
        }, 3000);
    })
}

// BOTONES
const buttonsParams = (device) => {
    buttonOne.addEventListener('click', () => {
        if (toggleOne == 0) {
            toggleOne = 1;
            toggleTwo = 0;
            toggleThree = 0;
            toggleFour = 0;
            toggleFive = 0;
            buttonOne.classList.add('selected');
            buttonTwo.classList.remove('selected');
            buttonThree.classList.remove('selected');
            buttonFour.classList.remove('selected');
            buttonFive.classList.remove('selected');

            device.parameters[0].value = theParams[0].density;
            device.parameters[1].value = theParams[0].grain_size;
            device.parameters[2].value = theParams[0].pitch;
            device.parameters[3].value = theParams[0].position;
            device.parameters[4].value = theParams[0].spray;
            device.parameters[5].value = theParams[0].spread;
            device.parameters[6].value = theParams[0].stereo_spread;

            colors();
        } else {
            toggleOne = 0;
            buttonOne.classList.remove('selected');
        }
    })

    buttonTwo.addEventListener('click', () => {
        if (toggleTwo == 0) {
            toggleTwo = 1;
            toggleOne = 0;
            toggleThree = 0;
            toggleFour = 0;
            toggleFive = 0;
            buttonTwo.classList.add('selected');
            buttonOne.classList.remove('selected');
            buttonThree.classList.remove('selected');
            buttonFour.classList.remove('selected');
            buttonFive.classList.remove('selected');

            device.parameters[0].value = theParams[1].density;
            device.parameters[1].value = theParams[1].grain_size;
            device.parameters[2].value = theParams[1].pitch;
            device.parameters[3].value = theParams[1].position;
            device.parameters[4].value = theParams[1].spray;
            device.parameters[5].value = theParams[1].spread;
            device.parameters[6].value = theParams[1].stereo_spread;

            colors();
        } else {
            toggleTwo = 0;
            buttonTwo.classList.remove('selected');
        }
    })

    buttonThree.addEventListener('click', () => {
        if (toggleThree == 0) {
            toggleThree = 1;
            toggleOne = 0;
            toggleTwo = 0;
            toggleFour = 0;
            toggleFive = 0;
            buttonThree.classList.add('selected');
            buttonOne.classList.remove('selected');
            buttonTwo.classList.remove('selected');
            buttonFour.classList.remove('selected');
            buttonFive.classList.remove('selected');

            device.parameters[0].value = theParams[2].density;
            device.parameters[1].value = theParams[2].grain_size;
            device.parameters[2].value = theParams[2].pitch;
            device.parameters[3].value = theParams[2].position;
            device.parameters[4].value = theParams[2].spray;
            device.parameters[5].value = theParams[2].spread;
            device.parameters[6].value = theParams[2].stereo_spread;

            colors();
        } else {
            toggleThree = 0;
            buttonThree.classList.remove('selected');
        }
    })

    buttonFour.addEventListener('click', () => {
        if (toggleFour == 0) {
            toggleFour = 1;
            toggleOne = 0;
            toggleTwo = 0;
            toggleThree = 0;
            toggleFive = 0;
            buttonFour.classList.add('selected');
            buttonOne.classList.remove('selected');
            buttonTwo.classList.remove('selected');
            buttonThree.classList.remove('selected');
            buttonFive.classList.remove('selected');

            device.parameters[0].value = theParams[3].density;
            device.parameters[1].value = theParams[3].grain_size;
            device.parameters[2].value = theParams[3].pitch;
            device.parameters[3].value = theParams[3].position;
            device.parameters[4].value = theParams[3].spray;
            device.parameters[5].value = theParams[3].spread;
            device.parameters[6].value = theParams[3].stereo_spread;

            colors();
        } else {
            toggleFour = 0;
            buttonFour.classList.remove('selected');
        }
    })

    buttonFive.addEventListener('click', () => {
        if (toggleFive == 0) {
            toggleFive = 1;
            toggleOne = 0;
            toggleTwo = 0;
            toggleThree = 0;
            toggleFour = 0
            buttonFive.classList.add('selected');
            buttonOne.classList.remove('selected');
            buttonTwo.classList.remove('selected');
            buttonThree.classList.remove('selected');
            buttonFour.classList.remove('selected');

            device.parameters[0].value = theParams[4].density;
            device.parameters[1].value = theParams[4].grain_size;
            device.parameters[2].value = theParams[4].pitch;
            device.parameters[3].value = theParams[4].position;
            device.parameters[4].value = theParams[4].spray;
            device.parameters[5].value = theParams[4].spread;
            device.parameters[6].value = theParams[4].stereo_spread;

            colors();
        } else {
            toggleFive = 0;
            buttonFive.classList.remove('selected');
        }
    })
}

// COLORS
const colors = () => {
    if (toggleOne == 1 && num == 1) {
        r.style.setProperty('--lineas', '#BFF6C3');
    } else if (toggleTwo == 1 && num == 1) {
        r.style.setProperty('--lineas', '#E5BEEC');
    } else if (toggleThree == 1 && num == 1) {
        r.style.setProperty('--lineas', '#B6FFFA');
    } else if (toggleFour == 1 && num == 1) {
        r.style.setProperty('--lineas', '#FFD93D');
    } else if (toggleFive == 1 && num == 1) {
        r.style.setProperty('--lineas', '#FF9F66');
    }
}

setup();

         /* density grain_size pitch position spray spread stereo_spread --------------------------------
         if (slider.id.match('density')) {
            let density = slider.getBoundingClientRect();
            console.log('Density TOP: ' + density.top);
            console.log('Density BUTTON: ' + density.bottom);
        } else if (slider.id.match('grain_size')) {
            let grain = slider.getBoundingClientRect();
            console.log('Grain size TOP: ' + grain.top);
            console.log('Grain size BUTTON: ' + grain.bottom);
        } else if (slider.id.match('pitch')) {
            let pitch = slider.getBoundingClientRect();
            console.log('Pitch TOP: ' + pitch.top);
            console.log('Pitch BUTTON: ' + pitch.bottom);
        } else if (slider.id.match('position')) {
            let position = slider.getBoundingClientRect();
            console.log('Position TOP: ' + position.top);
            console.log('Position BUTTON: ' + position.bottom);
        } else if (slider.id.match('spray')) {
            let spray = slider.getBoundingClientRect();
            console.log('Spray TOP: ' + spray.top);
            console.log('Spray BUTTON: ' + spray.bottom);
        } else if (slider.id.match('spread')) {
            let spread = slider.getBoundingClientRect();
            console.log('Spread TOP: ' + spread.top);
            console.log('Spread BUTTON: ' + spread.bottom);
        } else if (slider.id.match('stereo_spread')) {
            let stereo = slider.getBoundingClientRect();
            console.log('Stereo spread TOP: ' + stereo.bottom);
            console.log('Stereo spread BUTTON: ' + stereo.bottom);
        }
        obtener los límites de cada slider ----------------------------------------------------------- */