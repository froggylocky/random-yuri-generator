document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const resultImage = document.getElementById('result-image');
    const spinner = document.getElementById('loading-spinner');
    const errorMessage = document.getElementById('error-message');
    const imageInfo = document.getElementById('image-info');
    const sourceLink = document.getElementById('source-link');
    const clickSound = document.getElementById('click-sound');
    const soundToggle = document.getElementById('sound-toggle');
    const tagsContainer = document.getElementById('tags-container');
    const metadataContainer = document.getElementById('metadata-container');
    const ungenerateBtn = document.getElementById('ungenerate-btn');
    const topGif = document.getElementById('top-right-gif');
    const gifToggle = document.getElementById('gif-toggle');

    const SEARCH_TAGS = 'yuri';
    let totalPostsCount = 0;

    // Initialize by getting the total count of yuri posts
    async function init() {
        setLoadingState(true);
        try {
            // First API call just to get the count (using corsproxy to bypass CORS on localhost)
            const targetUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&tags=${SEARCH_TAGS}&limit=1`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            const response = await fetch(proxyUrl);
            const xmlText = await response.text();

            // Parse XML to get count attribute
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const postsElement = xmlDoc.getElementsByTagName("posts")[0];

            if (postsElement) {
                totalPostsCount = parseInt(postsElement.getAttribute("count"), 10);
                console.log(`Initial Setup: Found ${totalPostsCount} posts for tag '${SEARCH_TAGS}'`);

                // Auto-loading removed
                // await fetchRandomImage();
            } else {
                throw new Error("Could not parse post count from XML.");
            }
        } catch (error) {
            console.error("Initialization Error:", error);
            showError();
        } finally {
            setLoadingState(false);
        }
    }

    async function fetchRandomImage() {
        if (totalPostsCount === 0) return;

        // Play sound only if toggle is checked
        if (clickSound && soundToggle.checked) {
            clickSound.currentTime = 0; // Reset sound to start if it's already playing
            clickSound.play().catch(e => console.error("Error playing sound:", e));
        }

        setLoadingState(true);
        hideError();

        // Clear previous tags and metadata
        tagsContainer.innerHTML = '';
        metadataContainer.innerHTML = '';

        // Hide image smoothly before loading new one
        resultImage.classList.add('hidden');
        resultImage.style.position = 'absolute'; // Keep it out of flow while loading

        try {
            // Pick a random page offset (pid)
            // Safebooru pid is 0-indexed. 
            // The max limit depends, but limit=1 means pid=0 is 1st image, pid=1 is 2nd, etc.
            // Safebooru restricts API requests that go too deep (usually offset > ~200,000 or pid > ??)
            // Usually, randomizing pid up to total count works fine if limit=1
            // Let's constrain it slightly just in case the API has a hard limit on pid, but 100k+ usually works.

            // Note: Safebooru json api format:
            // https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=yuri&limit=1&pid=RandomNumber

            // A safer approach for totally random on Gelbooru-like systems if pid is clamped:
            // Safebooru seems mostly fine with large pids.
            const randomPid = Math.floor(Math.random() * totalPostsCount);

            const apiUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${SEARCH_TAGS}&limit=1&pid=${randomPid}`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

            const response = await fetch(proxyUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const post = data[0];

                // Choose the best URL. Safebooru usually provides sample_url or file_url within the JSON.
                // JSON structure: directory, image, id, etc.
                // Safebooru JSON is sometimes funky. The typical URL construction:
                // https://safebooru.org/images/{directory}/{image}
                // or https://safebooru.org/samples/{directory}/sample_{image}

                let imageUrl = '';

                if (post.sample_url) {
                    // Sometimes modern safebooru api provides this directly in json now? Usually it doesn't.
                    imageUrl = post.sample_url;
                } else if (post.directory && post.image) {
                    // Manually construct
                    // Check if we should use sample (usually if width > 850ish)
                    if (post.sample === 1 || post.sample === "true") {
                        // Note: safebooru file extension might change for sample, but usually it's jpg
                        // Let's just use the main file_url equivalent for simplicity and quality, 
                        // since we have a fast connection usually.
                        imageUrl = `https://safebooru.org/images/${post.directory}/${post.image}`;
                    } else {
                        imageUrl = `https://safebooru.org/images/${post.directory}/${post.image}`;
                    }
                } else if (post.file_url) {
                    imageUrl = post.file_url;
                }

                if (!imageUrl) {
                    // Fallback based on typical JSON response structure if above fails
                    imageUrl = `https://safebooru.org/images/${post.directory}/${post.image}`;
                }

                // Preload image to avoid visual glitching
                const img = new Image();
                img.onload = () => {
                    resultImage.src = imageUrl;
                    resultImage.style.position = 'relative';
                    resultImage.classList.remove('hidden');

                    // Update source link
                    sourceLink.href = `https://safebooru.org/index.php?page=post&s=view&id=${post.id}`;
                    imageInfo.classList.remove('hidden');
                    imageInfo.style.position = 'relative';

                    // Display tags
                    if (post.tags) {
                        const tagsArray = post.tags.trim().split(/\s+/);
                        tagsArray.forEach(tag => {
                            if (tag) {
                                const tagSpan = document.createElement('span');
                                tagSpan.className = 'tag';
                                tagSpan.textContent = tag.replace(/_/g, ' '); // Make readable
                                tagsContainer.appendChild(tagSpan);
                            }
                        });
                    }

                    // Display metadata
                    metadataContainer.innerHTML = '';

                    const sourceText = post.source ? post.source : 'Unknown';
                    const sourceEl = document.createElement('span');
                    sourceEl.innerHTML = `<strong>Source:</strong> ${sourceText.startsWith('http') ? `<a href="${sourceText}" target="_blank">${sourceText}</a>` : sourceText}`;
                    metadataContainer.appendChild(sourceEl);

                    const dateEl = document.createElement('span');
                    let displayDate = 'Unknown';
                    if (post.change) {
                        displayDate = new Date(post.change * 1000).toLocaleDateString();
                    }
                    dateEl.innerHTML = `<strong>Date:</strong> ${displayDate}`;
                    metadataContainer.appendChild(dateEl);

                    const posterEl = document.createElement('span');
                    // Safebooru usually returns creator_id, but sometimes owner in different JSON contexts
                    const creator = post.owner || post.creator_id || 'Unknown';
                    posterEl.innerHTML = `<strong>Posted By ID:</strong> ${creator}`;
                    metadataContainer.appendChild(posterEl);

                    const sizeEl = document.createElement('span');
                    const w = post.width || '?';
                    const h = post.height || '?';
                    sizeEl.innerHTML = `<strong>Size:</strong> ${w}x${h}`;
                    metadataContainer.appendChild(sizeEl);

                    // Show ungenerate button
                    ungenerateBtn.classList.remove('hidden');

                    setLoadingState(false);
                };
                img.onerror = () => {
                    throw new Error("Failed to load image from URL");
                };
                img.src = imageUrl;

            } else {
                throw new Error("No posts found in JSON response");
            }

        } catch (error) {
            console.error("Error fetching random image:", error);
            showError();
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            spinner.classList.remove('hidden');
            generateBtn.disabled = true;
            generateBtn.querySelector('.btn-text').textContent = 'Loading...';
            ungenerateBtn.disabled = true;
        } else {
            spinner.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.querySelector('.btn-text').textContent = 'Generate Image';
            ungenerateBtn.disabled = false;
        }
    }

    function ungenerateImage() {
        resultImage.classList.add('hidden');
        resultImage.style.position = 'absolute';
        resultImage.src = '';
        imageInfo.classList.add('hidden');
        imageInfo.style.position = 'absolute';
        tagsContainer.innerHTML = '';
        metadataContainer.innerHTML = '';
        ungenerateBtn.classList.add('hidden');
    }

    function showError() {
        errorMessage.classList.remove('hidden');
        errorMessage.style.position = 'relative';
        resultImage.classList.add('hidden');
        resultImage.style.position = 'absolute';
        imageInfo.classList.add('hidden');
        imageInfo.style.position = 'absolute';
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.style.position = 'absolute';
    }

    // Event Listeners
    generateBtn.addEventListener('click', fetchRandomImage);
    ungenerateBtn.addEventListener('click', ungenerateImage);

    // Toggle GIF visibility
    if (gifToggle && topGif) {
        gifToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                topGif.classList.remove('hidden');
            } else {
                topGif.classList.add('hidden');
            }
        });
    }

    // Initial setup Call
    init();
});
