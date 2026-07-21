
// Expose the function globally immediately so other pages can access it
window.generateAIOverview = generateAIOverview;

// Splits the subtitle text (segment array) into smaller, logical character chunks
function chunkText(segments, maxChunkChars = 1500) {
    const chunks = [];
    let currentChunk = "";

    for (const segment of segments) {
        const text = segment.text ? segment.text.trim() : "";
        if (!text) continue;

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

// processes, chunks, and summarises subtitle files using local Ollama
async function generateAIOverview(segments, uiContainer) {
    try {
        uiContainer.innerHTML = `<p class="ai-overview-status">🤖 Structuring text data for Ollama...</p>`;

        const allChunks = chunkText(segments, 4000);
        if (allChunks.length === 0) {
            uiContainer.innerHTML = `<p class="ai-overview-status">🤖 No content found to summarize.</p>`;
            return;
        }

        const maxChunks = 3;
        const chunksToProcess = allChunks.slice(0, maxChunks);
        const summaries = [];

        uiContainer.innerHTML = `<p class="ai-overview-status">🤖 Generating insights locally with Ollama...</p>`;

        for (let i = 0; i < chunksToProcess.length; i++) {
            uiContainer.innerHTML = `<p class="ai-overview-status">🤖 Analysing chunk ${i + 1} of${chunksToProcess.length}...</p>`;

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'phi3',
                    prompt: `You are an expert broadcast analyst. Provide a brief, one-sentence summary of this transcript chunk: \n\n${chunksToProcess[i]}`,
                    stream: false,
                    options: {
                        temperature: 0.2
                    }
                })
            });

            if (!response.ok) throw new Error("Could not connect to Ollama. Ensure the Ollama app is running.");

            const data = await response.json();
            summaries.push(data.response.trim());
        }

        let finalHTML = "";
        if (summaries.length > 1) {
            finalHTML = `<ul class="ai-bullet-list">` +
                summaries.map(s => `<li>${s}</li>`).join('') +
                `</ul>`;
            if (allChunks.length > maxChunks) {
                finalHTML += `<p style="font-size: 11px; color: #666; margin-top: 10px; font-style: italic;">Note: Only the first ${maxChunks} parts of this long transcript were summarized to keep performance fast.</p>`;
            }
        } else if (summaries.length === 1) {
            finalHTML = `<p>${summaries[0]}</p>`;
        } else {
            finalHTML = `<p>Could not generate transcript overview.</p>`;
        }

        uiContainer.innerHTML = `
            <div class="ai-overview-header">🤖 AI Summary:</div>
            <div class="ai-overview-body">${finalHTML}</div>
        `;

    } catch (err) {
        console.error("AI Overview processing error:", err);
        const errorMessage = err.message || "Ensure Ollama is installed and running.";
        uiContainer.innerHTML = `<p style="color: #e53935; font-weight: bold; margin: 0;">⚠️ AI Overview Failed: ${errorMessage}</p>`;
    }

}

// ===== ===== ===== DOM Elements ===== ===== =====
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

// ===== ===== ===== RENDER SUBTITLES ===== ===== =====
// function which renders the subtitles each time a file changes or the start/end times toggle switch is toggled
function renderSubtitles() {
    if (!listEl || !tocListEl) return;
    // clear old subtitles+reset table of contents
    listEl.innerHTML = '';
    tocListEl.innerHTML = '';

    if (uploadedFiles.length === 0) {
        if (tocContainer) tocContainer.style.display = 'none';
        if (viewerContainer) viewerContainer.style.display = 'none';
        if (statusText) statusText.textContent = "No data loaded";
        if (speakerStatusText) speakerStatusText.textContent = "No data loaded";
        return;
    }

    // times toggle switch
    if (toggleSwitch && statusText) {
        if (toggleSwitch.checked) {
            statusText.textContent = 'Start/End Times Hidden';
        } else {
            statusText.textContent = 'Start/End Times Shown';
        }
    }

    // speaker toggle switch
    if (speakerSwitch && speakerStatusText) {
        if (speakerSwitch.checked) {
            speakerStatusText.textContent = 'Speaker Only When Changed';
        } else {
            speakerStatusText.textContent = 'Speaker Always Visible';
        }
    }

    if (tocContainer) tocContainer.style.display = 'block';
    if (viewerContainer) viewerContainer.style.display = 'flex';

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

        // asection header (File name / AI overview of file)
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

        if (aiButton) {
            aiButton.addEventListener('click', () => {
                generateAIOverview(fileData.segments, overviewBox);
            });
        }

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
                if (toggleSwitch && !toggleSwitch.checked) {
                    start = segment.start ? `<small>[Start: ${segment.start}s]</small> ` : '';
                    end = segment.end ? `<small>[End: ${segment.end}s]</small> ` : '';
                }


                // speaker visibility
                let speaker = '';
                // when toggled on, the speaker ID is only shown when the speaker changes
                if (speakerSwitch && speakerSwitch.checked) {
                    if (speakerId && speakerId !== previousSpeaker) {
                        speaker = `<span class="${assignedColorClass}">[${speakerId}]:</span> `;
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
    if (!analysisPanel) return;

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

// ===== ===== ===== FILTER SUBTITLES ===== ===== =====
// used for the search bar to find matching subtitles
function filterSubtitles() {
    if (!searchInput) return;
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

// ===== ===== ===== PROTECTED EVENT LISTENERs ===== ===== =====
// only reads files and saves text to state (Subtitles) or loads media (Video/Audio)
if (fileInput) {
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
                    const objectURL = URL.createObjectURL(file);
                    if (videoPlayer) {
                        videoPlayer.src = objectURL;
                        videoPlayer.load(); // Forces the player to load the new source
                        console.log(`Loaded local media file into player: (${file.name})`);
                    }
                } catch (err) {
                    console.error(`Error loading media file ${file.name}:`, err);
                }
            }
        }

        renderSubtitles();
    });
}

if (toggleSwitch) toggleSwitch.addEventListener('change', renderSubtitles);
if (speakerSwitch) speakerSwitch.addEventListener('change', renderSubtitles);

if (searchButton) searchButton.addEventListener("click", filterSubtitles);
if (searchInput) {
    searchInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            filterSubtitles();
        }
    });
}