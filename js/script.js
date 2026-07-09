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
// remember loaded subtitle text
let uploadedFiles = [];
// for the speaker colours
const colorPool = [
    'color-red', 'color-orange', 'color-green', 'color-blue',
    'color-purple', 'color-pink', 'color-teal', 'color-darkred',
    'color-burnt', 'color-lime', 'color-magenta', 'color-navy'
];

// function which renders the subtitles each time a file changes or the start/end times toggle switch is toggled
function renderSubtitles() {
    // clear old subtitles+reset table of contents
    listEl.innerHTML = '';
    tocListEl.innerHTML = '';

    if (uploadedFiles.length === 0) {
        tocContainer.style.display = 'none';
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

        // asection header
        listEl.insertAdjacentHTML('beforeend', `
                <section class="file-group" id="${uniqueFileId}">
                    <h2 class="subtitleHeader">📄 File: ${fileData.name}</h2>
                    <ul class="subtitle-group"></ul>
                </section>
                `);

        const currentSubtitleList =
            document.querySelector(`#${uniqueFileId} .subtitle-group`);

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

                currentSubtitleList.insertAdjacentHTML(
                    'beforeend',
                    `<li class="subtitle-line">
                            ${speaker}${start}${end}${score}${textLine}
                            </li>`
                );
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

// only reads files and saves text to state
fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    uploadedFiles = []; // Clear the old cached state array

    if (!files || files.length === 0) {
        renderSubtitles();
        return;
    }

    for (const file of files) {
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
