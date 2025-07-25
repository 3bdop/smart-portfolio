import { TalkingHead } from "talkinghead";
// let acOptions = {
//     color: '#FFFFFFFF',
//     outerAlpha: 0.25,
//     size: {
//         inner: 8,
//         outer: 38
//     },
//     hoverScale: {
//         inner: 0.5,
//         outer: 1.4
//     },
//     clickScale: {
//         inner: 1.4,
//         outer: 0.1
//     }
// }

// let donutOpts = {
//     color: '#fff',
//     zIndex: 2147483647,

//     outerAlpha: 0,
//     outerBorderSize: 3
// }

// const ac = window.animatedCursor(acOptions)
// const ac = window.animatedCursor(donutOpts)

// ac.init()

const visemeMap = [
      /* 0  */ "sil",            // Silence
      /* 1  */ "aa",             // æ, ə, ʌ
      /* 2  */ "aa",             // ɑ
      /* 3  */ "O",              // ɔ
      /* 4  */ "E",              // ɛ, ʊ
      /* 5  */ "RR",              // ɝ
      /* 6  */ "I",              // j, i, ɪ
      /* 7  */ "U",              // w, u
      /* 8  */ "O",              // o
      /* 9  */ "O",             // aʊ
      /* 10 */ "O",              // ɔɪ
      /* 11 */ "I",              // aɪ
      /* 12 */ "kk",             // h
      /* 13 */ "RR",             // ɹ
      /* 14 */ "nn",             // l
      /* 15 */ "SS",             // s, z
      /* 16 */ "CH",             // ʃ, tʃ, dʒ, ʒ
      /* 17 */ "TH",             // ð
      /* 18 */ "FF",             // f, v
      /* 19 */ "DD",             // d, t, n, θ
      /* 20 */ "kk",             // k, g, ŋ
      /* 21 */ "PP"              // p, b, m
];

let head;
let microsoftSynthesizer = null;
let isProcessing = false;
let currentAnswerForEmojis;
let emojiTextMap;

function resetLipsyncBuffers() {
    visemesbuffer = {
        visemes: [],
        vtimes: [],
        vdurations: [],
    };
    prevViseme = null;
    wordsbuffer = {
        words: [],
        wtimes: [],
        wdurations: []
    };
}

let visemesbuffer = null;
let prevViseme = null;
let wordsbuffer = null;
let lipsyncType = "visemes";
resetLipsyncBuffers();

// NEW: Function to play emoji animation directly
function playEmoji(emoji) {
    console.log(`Playing emoji animation: ${emoji}`);
    // console.log(emoji)

    // Find the right animation template
    let animTemplate = head.animEmojis[emoji];
    if (animTemplate && animTemplate.link) {
        animTemplate = head.animEmojis[animTemplate.link];
    }

    if (animTemplate) {
        // Look at the camera for 500 ms (optional)
        head.lookAtCamera(500);

        // Add the animation to the animation queue
        const anim = head.animFactory(animTemplate);
        head.animQueue.push(anim);
    } else {
        console.warn(`No animation template found for emoji: ${emoji}`);
    }
}

// NEW: Function to check and play emojis based on subtitle text
function checkAndPlayEmojisForSubtitle(subtitleText, originalText) {
    // Create a mapping of clean text to emojis
    if (!emojiTextMap) {
        emojiTextMap = createEmojiTextMapping(originalText);
    }

    // Check if any of the subtitle words should trigger an emoji
    const subtitleWords = subtitleText.toLowerCase().trim().split(/\s+/);
    subtitleWords.forEach(word => {
        // Remove punctuation for matching
        const cleanWord = word.replace(/[.,!?;:]/g, '');

        if (emojiTextMap[cleanWord]) {
            const emoji = emojiTextMap[cleanWord];
            console.log(`Triggering emoji ${emoji} for word: ${cleanWord}`);
            playEmoji(emoji);

            // Remove from map to avoid playing the same emoji multiple times
            delete emojiTextMap[cleanWord];
        }
    });
}

// NEW: Create mapping between words and their associated emojis
function createEmojiTextMapping(originalText) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/gu;
    const mapping = {};

    // Split text into segments around emojis
    const segments = originalText.split(emojiRegex);
    const emojis = originalText.match(emojiRegex) || [];

    emojis.forEach((emoji, index) => {
        // Get the text segment before this emoji
        const beforeSegment = segments[index] || '';

        // Find the last few words before the emoji
        const words = beforeSegment.trim().split(/\s+/);
        const lastWord = words[words.length - 1];

        if (lastWord) {
            // Remove punctuation and convert to lowercase for consistent matching
            const cleanLastWord = lastWord.replace(/[.,!?;:]/g, '').toLowerCase();
            mapping[cleanLastWord] = emoji;
            console.log(`Mapped word "${cleanLastWord}" to emoji ${emoji}`);
        }
    });

    return mapping;
}

// NEW: Function to clean text of emojis for TTS
function cleanTextForTTS(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/gu;
    return text.replace(emojiRegex, '').replace(/\s+/g, ' ').trim();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Loading Talking Head...");
    const nodeAvatar = document.getElementById('avatar');
    const nodeSpeak = document.getElementById('speak');
    const nodeLoading = document.getElementById('loading');
    const settingsButton = document.getElementById('settings-button');
    const inputText = document.getElementById('text')

    // Initialize TalkingHead
    head = new TalkingHead(nodeAvatar, {
        ttsEndpoint: "/gtts/",
        cameraView: document.querySelector('input[name="view_type"]:checked').value,
        lipsyncLang: "ar",
    });

    document.querySelectorAll('input[name="view_type"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (head) {
                head.setView(event.target.value);
            }
        });
    });

    // Show "Loading..." by default
    // nodeLoading.textContent = "Loading...";

    // Load the avatar
    try {
        await head.showAvatar(
            {
                url: 'https://models.readyplayer.me/671fba5095f66d10f33251c6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
                body: 'M',
            },
            (ev) => {
                if (ev.lengthComputable) {
                    const percent = Math.round((ev.loaded / ev.total) * 100);
                    // nodeLoading.textContent = `Loading ${percent}%`;
                    nodeLoading.disabled = false
                } else {
                    nodeLoading.disabled = true
                    // nodeLoading.textContent = `Loading... ${Math.round(ev.loaded / 1024)} KB`;
                }
            }
        );
        // Hide the loading element once fully loaded
        nodeLoading.style.display = 'none';
    } catch (error) {
        console.error("Error loading avatar:", error);
        nodeLoading.textContent = "Failed to load avatar.";
    }

    async function getAnswerFromBackend(question) {
        try {
            const response = await fetch('/api/ask-me', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.answer;
        } catch (error) {
            console.error("Error fetching answer:", error);
            return "Sorry, I encountered an error while processing your request.";
        }
    }

    async function handleSpeak() {
        const question = inputText.value.trim();

        if (isProcessing) {
            console.log("Please wait until current request is completed");
            return;
        }

        if (question) {
            nodeSpeak.disabled = true;
            document.getElementById('btn-txt').textContent = 'Thinking...';
            document.getElementById('speak').disabled = true;

            try {
                const answer = await getAnswerFromBackend(question);

                // MODIFIED: Clean the answer for TTS but keep original for emoji processing
                const cleanAnswer = cleanTextForTTS(answer);
                const ssml = textToSSML(cleanAnswer);

                // Store original answer for emoji processing and reset emoji map
                currentAnswerForEmojis = answer;

                azureSpeak(ssml);
            } catch (error) {
                console.error("Error:", error);
                alert("Failed to get response from the assistant.");
            }
        }
    }

    // Handle button click
    nodeSpeak.addEventListener('click', handleSpeak);

    // Handle Enter press in input
    inputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSpeak();
        }
    });

    // Pause/resume animation on visibility change
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            head.start();
        } else {
            head.stop();
        }
    });

    // Basic language detection: returns 'ar' or 'en'
    function detectLanguage(text) {
        const arabicRegex = /[\u0600-\u06FF]/;
        const englishRegex = /[A-Za-z]/;

        const arabicCount = (text.match(new RegExp(arabicRegex, 'g')) || []).length;
        const englishCount = (text.match(new RegExp(englishRegex, 'g')) || []).length;

        return arabicCount > englishCount ? 'ar' : 'en';
    }

    // Convert input text to SSML with dynamic language support
    function textToSSML(text) {
        const lang = detectLanguage(text);
        let voiceName, langCode;

        if (lang === 'ar') {
            voiceName = 'ar-AE-HamdanNeural';
            langCode = 'ar-AE';
        } else {
            voiceName = 'en-US-AndrewNeural';
            langCode = 'en-US';
        }

        return `
    <speak version="1.0" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${langCode}">
      <voice name="${voiceName}">
        <mstts:viseme type="FacialExpression" />
        <prosody rate="-18%">
          ${text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}
        </prosody>
      </voice>
    </speak>`;
    }

    // MODIFIED: Enhanced Azure TTS with emoji marker support
    async function azureSpeak(ssml) {
        if (!microsoftSynthesizer) {
            // Retrieve config from input fields
            const resp = await fetch("/api/azure-speech-token");
            if (!resp.ok) throw new Error("Token fetch failed");
            const { token, region } = await resp.json();

            const config = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
            config.speechSynthesisOutputFormat =
                window.SpeechSDK.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm;
            microsoftSynthesizer = new window.SpeechSDK.SpeechSynthesizer(config, null);

            // Handle the synthesis results
            microsoftSynthesizer.synthesizing = (s, e) => {
                switch (lipsyncType) {
                    case "blendshapes":
                        head.streamAudio({
                            audio: e.result.audioData,
                            anims: azureBlendShapes?.sbuffer.splice(0, azureBlendShapes?.sbuffer.length)
                        });
                        break;
                    case "visemes":
                        head.streamAudio({
                            audio: e.result.audioData,
                            visemes: visemesbuffer.visemes.splice(0, visemesbuffer.visemes.length),
                            vtimes: visemesbuffer.vtimes.splice(0, visemesbuffer.vtimes.length),
                            vdurations: visemesbuffer.vdurations.splice(0, visemesbuffer.vdurations.length),
                        });
                        break;
                    case "words":
                        head.streamAudio({
                            audio: e.result.audioData,
                            words: wordsbuffer.words.splice(0, wordsbuffer.words.length),
                            wtimes: wordsbuffer.wtimes.splice(0, wordsbuffer.wtimes.length),
                            wdurations: wordsbuffer.wdurations.splice(0, wordsbuffer.wdurations.length)
                        });
                        break;
                    default:
                        console.error(`Unknown animation mode: ${lipsyncType}`);
                }
            };

            // Viseme handling
            microsoftSynthesizer.visemeReceived = (s, e) => {
                if (lipsyncType === "visemes") {
                    const vtime = e.audioOffset / 10000;
                    const viseme = visemeMap[e.visemeId];
                    if (!head.isStreaming) return;
                    if (prevViseme) {
                        let vduration = vtime - prevViseme.vtime;
                        if (vduration < 40) vduration = 40;
                        visemesbuffer.visemes.push(prevViseme.viseme);
                        visemesbuffer.vtimes.push(prevViseme.vtime);
                        visemesbuffer.vdurations.push(vduration);
                    }
                    prevViseme = { viseme, vtime };

                } else if (lipsyncType === "blendshapes") {
                    let animation = null;
                    if (e?.animation && e.animation.trim() !== "") {
                        try {
                            animation = JSON.parse(e.animation);
                        } catch (error) {
                            console.error("Error parsing animation blendshapes:", error);
                            return;
                        }
                    }
                    if (!animation) return;
                    const vs = {};
                    AzureBlendshapeMap.forEach((mtName, i) => {
                        vs[mtName] = animation.BlendShapes.map(frame => frame[i]);
                    });

                    azureBlendShapes.sbuffer.push({
                        name: "blendshapes",
                        delay: animation.FrameIndex * 1000 / 60,
                        dt: Array.from({ length: animation.BlendShapes.length }, () => 1000 / 60),
                        vs: vs,
                    });
                }
            };

            // Process word boundaries and punctuations
            microsoftSynthesizer.wordBoundary = function (s, e) {
                const word = e.text;
                const time = e.audioOffset / 10000;
                const duration = e.duration / 10000;

                if (e.boundaryType === "PunctuationBoundary" && wordsbuffer.words.length) {
                    wordsbuffer.words[wordsbuffer.words.length - 1] += word;
                    wordsbuffer.wdurations[wordsbuffer.wdurations.length - 1] += duration;
                } else if (e.boundaryType === "WordBoundary" || e.boundaryType === "PunctuationBoundary") {
                    wordsbuffer.words.push(word);
                    wordsbuffer.wtimes.push(time);
                    wordsbuffer.wdurations.push(duration);
                }
            };
        }

        // Start stream speaking
        head.streamStart(
            { sampleRate: 48000, mood: "happy", gain: 0.5, lipsyncType: lipsyncType },
            () => {
                console.log("Audio playback started.");
                const subtitlesElement = document.getElementById("subtitles");
                subtitlesElement.textContent = "";
                subtitlesElement.style.display = "none";
                subtitlesElement.setAttribute('data-lines', 0)
                document.getElementById('btn-txt').textContent = 'Playing...';
            },
            () => {
                console.log("Audio playback ended.");
                const subtitlesElement = document.getElementById("subtitles");
                const displayDuration = Math.max(2000, subtitlesElement.textContent.length * 50);
                setTimeout(() => {
                    subtitlesElement.textContent = "";
                    subtitlesElement.style.display = "none";

                    // Reset all states here
                    isProcessing = false;
                    nodeSpeak.disabled = false;
                    document.getElementById('btn-txt').textContent = 'Ask';
                    document.getElementById('speak').disabled = false;
                    document.getElementById('text').value = '';
                    currentAnswerForEmojis = null;
                    emojiTextMap = null;

                }, displayDuration);
            },
            (subtitleText) => {
                console.log("subtitleText: ", subtitleText);

                // NEW: Check for emojis in the original text and play them when corresponding words are spoken
                // if (currentAnswerForEmojis) {
                checkAndPlayEmojisForSubtitle(subtitleText, currentAnswerForEmojis);
                // }

                const subtitlesElement = document.getElementById("subtitles");
                const currentText = subtitlesElement.textContent;
                const words = subtitleText.split(' ');
                const MAX_LINES = 2;

                let currentLines = parseInt(subtitlesElement.getAttribute('data-lines') || '0');

                subtitlesElement.style.display = "block";
                subtitlesElement.textContent += subtitleText;

                const styles = window.getComputedStyle(subtitlesElement);
                const lineHeight = parseInt(styles.lineHeight);
                const height = subtitlesElement.offsetHeight;
                const actualLines = Math.ceil(height / lineHeight);

                if (actualLines > MAX_LINES) {
                    const allWords = subtitlesElement.textContent.split(' ');
                    const removeCount = Math.ceil(allWords.length / 3);
                    subtitlesElement.textContent = '... ' + allWords.slice(removeCount).join(' ');
                }

                subtitlesElement.setAttribute('data-lines', actualLines.toString());
            }
        );

        // Perform TTS
        microsoftSynthesizer.speakSsmlAsync(
            ssml,
            (result) => {
                if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                    if (lipsyncType === "visemes" && prevViseme) {
                        const finalDuration = 100;
                        visemesbuffer.visemes.push(prevViseme.viseme);
                        visemesbuffer.vtimes.push(prevViseme.vtime);
                        visemesbuffer.vdurations.push(finalDuration);
                        prevViseme = null;
                    }

                    let speak = {};

                    if (lipsyncType === "visemes" && visemesbuffer.visemes.length) {
                        speak.visemes = visemesbuffer.visemes.splice(0, visemesbuffer.visemes.length);
                        speak.vtimes = visemesbuffer.vtimes.splice(0, visemesbuffer.vtimes.length);
                        speak.vdurations = visemesbuffer.vdurations.splice(0, visemesbuffer.vdurations.length);
                    }
                    if (lipsyncType === "blendshapes") {
                        speak.anims = azureBlendShapes?.sbuffer.splice(0, azureBlendShapes?.sbuffer.length);
                    }

                    speak.words = wordsbuffer.words.splice(0, wordsbuffer.words.length);
                    speak.wtimes = wordsbuffer.wtimes.splice(0, wordsbuffer.wtimes.length);
                    speak.wdurations = wordsbuffer.wdurations.splice(0, wordsbuffer.wdurations.length);

                    if (speak.visemes || speak.words || speak.anims) {
                        speak.audio = new ArrayBuffer(0);
                        head.streamAudio(speak);
                    }

                    head.streamNotifyEnd();
                    resetLipsyncBuffers();


                    console.log("Speech synthesis completed.");
                }
            },
            (error) => {
                console.error("Azure speech synthesis error:", error);
                resetLipsyncBuffers();
                currentAnswerForEmojis = null;
                emojiTextMap = null;
            }
        );
    }

    // Toggle the settings panel on/off
    settingsButton.addEventListener('click', () => {
        document.body.classList.toggle('show-settings');
    });
});