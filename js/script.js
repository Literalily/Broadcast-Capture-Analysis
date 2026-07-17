// Import hugging face + use GPU to run hugging face ai with WebGPU
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

// Check if the browser supports WebGPU
async function checkWebGPUSupport() {
    if (!navigator.gpu) return false;
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch (e) {
        return false;
    }
}

let summarizerPromise = null;

// This function will now safely load the model ONLY when the user clicks "Generate"
async function getSummarizer() {
    if (!summarizerPromise) {
        const supportsWebGPU = await checkWebGPUSupport();

        // Initialize the model lazily with memory-optimized configs
        summarizerPromise = pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
            device: supportsWebGPU ? 'webgpu' : 'wasm',
            // fp16 is optimal for WebGPU; q8 (8-bit quantization) prevents WASM OOM crashes
            dtype: supportsWebGPU ? 'fp16' : 'q8',
        });
    }
    return summarizerPromise;
}



// for the subtitle files
const fileInput = document.querySelector('#file');
// for the table of contents
const listEl = document.querySelector('#subtitle-list');
const tocContainer = document.querySelector('#toc-container');
const tocListEl = document.querySelector('#toc-list');
// for the start/end times toggle switch
const toggleSwitch = document.getElementById('mySwitch');
const statusText = document.getElementById('status');
// for the speaker toggle switch
const speakerSwitch = document.getElementById('mySpeakerSwitch');
const speakerStatusText = document.getElementById('speakerStatus');
// for the cards to appear only when needed
const subtitlesCard = document.getElementById('subtitles-card');
const analysisCard = document.getElementById('analysis-card');
const videoCard = document.getElementById('video-card');
// for the search bar
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
// video player
const viewerContainer = document.getElementById('viewer-container');
const videoPlayer = document.getElementById('subtitleVideo');
// remember loaded subtitle text
let uploadedFiles = [];
// for the speaker colours
const colorPool = [
    'color-red', 'color-orange', 'color-green', 'color-blue',
    'color-purple', 'color-pink', 'color-teal', 'color-darkred',
    'color-burnt', 'color-lime', 'color-magenta', 'color-navy'
];

// take chunks of the etxt at a time to not overload the AI
// Splits segment array texts into safe, logical character chunks.
//  * Standardizes sizes below 3000 characters to keep browser-based LLMs from overflowing memory.

function chunkText(segments, maxChunkChars = 1500) {
    const chunks = [];
    let currentChunk = "";

    for (const segment of segments) {
        const text = segment.text ? segment.text.trim() : "";
        if (!text) continue;

        // If adding this text exceeds max limit, push current chunk and start a new one
        if ((currentChunk + " " + text).length > maxChunkChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = text;
        } else {
            currentChunk = currentChunk ? currentChunk + " " + text : text;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

/**
 * Background function that processes, chunks, and summarizes subtitle files.
 * Hybrid Mode: Uses the Cloud API if an HF Token is provided, otherwise falls back to the local WebGPU/WASM engine.
 */
async function generateAIOverview(segments, uiContainer) {
    try {
        uiContainer.innerHTML = `<p class="ai-overview-status">🤖 Structuring text data...</p>`;

        const allChunks = chunkText(segments, 3500);
        if (allChunks.length === 0) {
            uiContainer.innerHTML = `<p class="ai-overview-status">🤖 No content found to summarize.</p>`;
            return;
        }

        // SAFETY CAP: Max 3 chunks processed to prevent wait timeouts
        const maxChunks = 3;
        const chunksToProcess = allChunks.slice(0, maxChunks);

        // 1. Retrieve the token from your existing Card 1 input field
        const hfTokenInput = document.getElementById('webHfToken');
        const hfToken = hfTokenInput ? hfTokenInput.value.trim() : "";

        const summaries = [];

        if (hfToken) {
            // --- CLOUD API PATH ---
            uiContainer.innerHTML = `<p class="ai-overview-status">☁️ Connecting to Hugging Face Cloud API...</p>`;

            // We'll use bart-large-cnn for incredibly polished, highly accurate summaries
            const modelId = 'facebook/bart-large-cnn';

            for (let i = 0; i < chunksToProcess.length; i++) {
                uiContainer.innerHTML = `<p class="ai-overview-status">☁️ Cloud API: Summarizing chunk ${i + 1} of ${chunksToProcess.length}...</p>`;

                const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
                    headers: {
                        "Authorization": `Bearer ${hfToken}`,
                        "Content-Type": "application/json"
                    },
                    method: "POST",
                    body: JSON.stringify({
                        inputs: chunksToProcess[i],
                        parameters: {
                            max_length: 80,
                            min_length: 25
                        },
                        options: {
                            // ESSENTIAL: If the cloud model is "sleeping", this tells Hugging Face 
                            // to spin it up and wait instead of throwing a 503 error immediately.
                            wait_for_model: true
                        }
                    })
                });

                const result = await response.json();

                if (response.ok && Array.isArray(result) && result[0]?.summary_text) {
                    summaries.push(result[0].summary_text);
                } else if (result.error) {
                    throw new Error(`HF API Error: ${result.error}`);
                } else {
                    throw new Error(`Unexpected cloud response format.`);
                }
            }
        } else {
            // --- LOCAL WEB ASSEMBLY / WEBGPU FALLBACK ---
            uiContainer.innerHTML = `<p class="ai-overview-status">🤖 Loading local AI engine (first run takes about 30 seconds)...</p>`;
            const summarizer = await getSummarizer();

            for (let i = 0; i < chunksToProcess.length; i++) {
                uiContainer.innerHTML = `<p class="ai-overview-status">🤖 Local GPU: Summarizing chunk ${i + 1} of ${chunksToProcess.length}... (Please do not close tab)</p>`;

                const output = await summarizer(chunksToProcess[i], {
                    max_length: 50,
                    min_length: 15,
                    num_beams: 1,
                    temperature: 1.0,
                });

                if (output && output[0] && output[0].summary_text) {
                    summaries.push(output[0].summary_text);
                }
            }
        }

        let finalHTML = "";
        if (summaries.length > 1) {
            finalHTML = `<ul class="ai-bullet-list">` +
                summaries.map(s => `<li>${s.trim()}</li>`).join('') +
                `</ul>`;
            if (allChunks.length > maxChunks) {
                finalHTML += `<p style="font-size: 11px; color: #666; margin-top: 10px; font-style: italic;">Note: Only the first ${maxChunks} parts of this long transcript were summarized to keep performance fast.</p>`;
            }
        } else if (summaries.length === 1) {
            finalHTML = `<p>${summaries[0]}</p>`;
        } else {
            finalHTML = `<p>Could not generate transcript overview.</p>`;
        }

        const sourceLabel = hfToken ? "☁️ Cloud API" : "🤖 Local AI Engine";
        uiContainer.innerHTML = `
            <div class="ai-overview-header">${sourceLabel} Summary:</div>
            <div class="ai-overview-body">${finalHTML}</div>
        `;

    } catch (err) {
        console.error("AI Overview processing error:", err);
        uiContainer.innerHTML = `<p style="color: #e53935; font-weight: bold; margin: 0;">⚠️ AI Overview Failed: ${err.message}</p>`;
    }
}

// function which renders the subtitles each time a file changes or the start/end times toggle switch is toggled
function renderSubtitles() {
    // clear old subtitles+reset table of contents
    listEl.innerHTML = '';
    tocListEl.innerHTML = '';

    if (uploadedFiles.length === 0) {
        tocContainer.style.display = 'none';
        viewerContainer.style.display = 'none'; // Hide parent container
        statusText.textContent = "No data loaded";
        speakerStatusText.textContent = "No data loaded";
        return;
    }

    // times toggle switch
    if (toggleSwitch.checked) {
        statusText.textContent = 'Start/End Times Hidden';
    } else {
        statusText.textContent = 'Start/End Times Shown';
    }

    // speaker toggle switch
    if (speakerSwitch.checked) {
        speakerStatusText.textContent = 'Speaker Only When Changed';
    } else {
        speakerStatusText.textContent = 'Speaker Always Visible';
    }

    tocContainer.style.display = 'block';
    viewerContainer.style.display = 'flex';

    const speakerColorMap = {};
    let colorIndex = 0;
    let fileIndex = 0;

    uploadedFiles.forEach(fileData => {
        const uniqueFileId = `file-anchor-${fileIndex}`;
        let previousSpeaker = null; // this is used so that the speaker ID is only shown once per segment and when speaker changes

        // if broken file state
        if (fileData.error) {
            listEl.insertAdjacentHTML('beforeend', `
                    <li style="color:red; margin-top:20px;">
                        Failed to read or parse ${fileData.name}. (${fileData.error})
                    </li>
                `);
            return;
        }

        // append to table of contents
        tocListEl.insertAdjacentHTML('beforeend', `
                <li><a href="#${uniqueFileId}">${fileData.name}</a></li>
                `);

        // asection header (File name \n AI overview of file)
        listEl.insertAdjacentHTML('beforeend', `
            <section class="file-group" id="${uniqueFileId}">
                <h2 class="subtitleHeader">📄 File: ${fileData.name}</h2>
                <div id="ai-overview-${uniqueFileId}" class="ai-overview-container">
                    <p class="ai-overview-status" style="margin-bottom: 10px;">🤖 Local AI Summary is ready to analyze this file.</p>
                    <button class="ai-btn" id="btn-ai-${uniqueFileId}">✨ Generate Summary</button>
                </div>
                <ul class="subtitle-group"></ul>
            </section>
        `);

        // Set up click listener for button instead of auto-running immediately
        const overviewBox = document.getElementById(`ai-overview-${uniqueFileId}`);
        const aiButton = document.getElementById(`btn-ai-${uniqueFileId}`);

        aiButton.addEventListener('click', () => {
            generateAIOverview(fileData.segments, overviewBox);
        });

        const currentSubtitleList = document.querySelector(`#${uniqueFileId} .subtitle-group`);

        if (fileData.segments) {
            fileData.segments.forEach(segment => {
                const speakerId = segment.speaker;
                let assignedColorClass = '';

                if (speakerId) {
                    if (!speakerColorMap[speakerId]) {
                        speakerColorMap[speakerId] = colorPool[colorIndex % colorPool.length];
                        colorIndex++;
                    }
                    assignedColorClass = speakerColorMap[speakerId];
                }

                const textLine = segment.text;
                const score = segment.score ? `<span style="color: #87CEEB;">[Score: ${segment.score}]</span> ` : '';

                // dynamic updating for toggle switch - only updates if the switch is on
                let start = '';
                let end = '';
                if (!toggleSwitch.checked) {
                    start = segment.start ? `<small>[Start: ${segment.start}s]</small> ` : '';
                    end = segment.end ? `<small>[End: ${segment.end}s]</small> ` : '';
                }


                // speaker visibility
                let speaker = '';
                // when toggled on, the speaker ID is only shown when the speaker changes
                if (speakerSwitch.checked) {
                    if (speakerId && speakerId !== previousSpeaker) {
                        speaker = `<span class="${assignedColorClass}">
            [${speakerId}]:
        </span> `;
                    }

                    previousSpeaker = speakerId;

                } else {
                    // when toggled off, the speakerID is always shown
                    if (speakerId) {
                        speaker = `<span class="${assignedColorClass}">
            [${speakerId}]:
        </span> `;
                    }

                    previousSpeaker = speakerId;
                }

                // Build element and attach event listener for interactive click sentiment analysis
                const li = document.createElement('li');
                li.className = 'subtitle-line';
                li.innerHTML = `${speaker}${start}${end}${score}${textLine}`;

                // dynamic click listener to analyze specific line
                li.addEventListener('click', () => {
                    analyzeIndividualLine(textLine, speakerId, segment.start);
                });

                currentSubtitleList.appendChild(li);
            });
        } else {
            currentSubtitleList.insertAdjacentHTML(
                'beforeend',
                `<li class="subtitle-line" style="color:orange;">
                            Warning: ${fileData.name} format unrecognized.
                        </li>`
            );
        }

        fileIndex++;
    });
    filterSubtitles();
}

// sentiment and video alignment function
function analyzeIndividualLine(text, speaker, start) {
    const analysisPanel = document.getElementById("selected-line-analysis");

    const speakerLabel = speaker ? `<strong>[${speaker}]</strong>: ` : '';
    analysisPanel.innerHTML = `
        <p><strong>Selected Line:</strong></p>
        <p style="margin: 10px 0;">${speakerLabel}"${text}"</p>
        <p><small>Timestamp: ${start} seconds</small></p>
    `;

    // saves the clicked subtitle data
    analysisPanel.dataset.rawText = text;

    if (videoPlayer && start !== undefined && start !== null) {
        // Check if the video has successfully loaded metadata (readyState >= 1)
        if (videoPlayer.readyState >= 1) {
            videoPlayer.currentTime = parseFloat(start);
            videoPlayer.play().catch(error => {
                console.log("Autoplay blocked or interrupted:", error);
            });
        } else {
            console.warn("Video file is missing or still loading. Unable to jump to timestamp:", start);
        }
    }

    if (window.analyzeText) {
        window.analyzeText(text);
    } else {
        document.getElementById('result').innerText = "AI is not initialized yet. Please wait.";
    }
}

// used for the search bar to find matching subtitles
function filterSubtitles() {
    const searchTerm = searchInput.value.toLowerCase();
    const fileGroups = document.querySelectorAll(".file-group");
    fileGroups.forEach(group => {
        const subtitles = group.querySelectorAll(".subtitle-line");
        let foundMatch = false;
        subtitles.forEach(line => {
            if (line.textContent.toLowerCase().includes(searchTerm)) {
                line.style.display = "";
                foundMatch = true;
            } else {
                line.style.display = "none";
            }
        });
        // Hide the entire file if nothing matched
        group.style.display = foundMatch ? "" : "none";
    });
}

// only reads files and saves text to state (Subtitles) or loads media (Video/Audio)
fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    uploadedFiles = []; // Clear the old cached subtitle state array

    if (!files || files.length === 0) {
        renderSubtitles();
        return;
    }

    for (const file of files) {
        const extension = file.name.split('.').pop().toLowerCase();
        const isMedia = file.type.startsWith('video/') ||
            file.type.startsWith('audio/') ||
            ['mp4', 'mkv', 'mov', 'avi', 'ts', 'mp3', 'wav', 'm4a', 'flac'].includes(extension);

        if (extension === 'json') {
            // Handle Subtitle JSON parsing
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                console.log(`Cached state data for (${file.name})`);

                uploadedFiles.push({ name: file.name, segments: data.segments });
            } catch (err) {
                console.error(`Error reading file ${file.name}:`, err);
                uploadedFiles.push({ name: file.name, error: err.message });
            }
        }
        else if (isMedia) {
            // Handle Video/Audio stream load
            try {
                // Create a temporary local URL pointing directly to the file on your disk
                const objectURL = URL.createObjectURL(file);

                videoPlayer.src = objectURL;
                videoPlayer.load(); // Forces the player to load the new source

                console.log(`Loaded local media file into player: (${file.name})`);
            } catch (err) {
                console.error(`Error loading media file ${file.name}:`, err);
            }
        }
    }

    renderSubtitles();
});

toggleSwitch.addEventListener('change', () => {
    renderSubtitles();
});

speakerSwitch.addEventListener('change', () => {
    renderSubtitles();
});

// for the search bar - only runs when search button is clicked/enter is pressed
searchButton.addEventListener("click", filterSubtitles);
searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        filterSubtitles();
    }
});











// // Filter DIY =================
// const filterList = document.querySelector('#filter-list');
// let uploadedFolder = [];

// function renderFilter() {
//     filterList.innerHTML = '';

//     if (uploadedFolder.length === 0) {
//         filterList.textContent = "No data loaded";
//         return;
//     }

//     filterList.insertAdjacentHTML('beforeend', `<button class="btn active" onclick="filterSelection('all')"> Show all</button>`)
//     filterList.insertAdjacentHTML('beforeend', `<button class="btn active" onclick="filterSelection('${folder}')">${folder.name}</button>`)

// }
