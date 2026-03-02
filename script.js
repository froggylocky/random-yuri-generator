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

    const SEARCH_TAGS = 'yuri';
    let totalPostsCount = 0;

    // Initialize by getting the total count of yuri posts
    async function init() {
        setLoadingState(true);
        hideError();
        try {
            // First API call just to get the count
            // Safebooru natively supports CORS, so we can fetch directly
            const targetUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&tags=${SEARCH_TAGS}&limit=1`;
            const response = await fetch(targetUrl);
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

    async function fetchRandomImage(eventOrRetryCount) {
        let retryCount = typeof eventOrRetryCount === 'number' ? eventOrRetryCount : 0;

        hideError();

        if (totalPostsCount === 0) {
            // Mobile network initial fetch might fail; retry on click.
            console.log("Retrying initial post count fetch...");
            await init();
            if (totalPostsCount === 0) {
                showError();
                return;
            }
        }

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

        ungenerateBtn.classList.add('hidden');
        ungenerateBtn.disabled = true;

        try {
            // Pick a random page offset (pid)
            // Safebooru pid is 0-indexed. 
            // The max limit depends, but limit=1 means pid=0 is 1st image, pid=1 is 2nd, etc.
            // Safebooru restricts API requests that go too deep.
            // Based on testing, pids > 100,000 can start failing or returning API limits.
            // We clamp the maximum limit to ensure reliability.
            const maxSafeCount = Math.min(totalPostsCount, 100000);
            const randomPid = Math.floor(Math.random() * maxSafeCount);

            const apiUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${SEARCH_TAGS}&limit=1&pid=${randomPid}`;

            // Fetch natively without proxy for faster, more reliable loading
            const response = await fetch(apiUrl);

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

                // Prefer sample_url for significantly faster loading times.
                // Fallback to file_url or constructed URL.
                if (post.sample_url && post.sample_url !== '') {
                    // Safebooru sometimes uses relative // URLs
                    imageUrl = post.sample_url.startsWith('//') ? 'https:' + post.sample_url : post.sample_url;
                } else if (post.file_url && post.file_url !== '') {
                    imageUrl = post.file_url.startsWith('//') ? 'https:' + post.file_url : post.file_url;
                } else if (post.directory && post.image) {
                    if (post.sample) {
                        // Constructed sample URL, usually `.jpg` instead of original extension.
                        const baseName = post.image.split('.')[0];
                        imageUrl = `https://safebooru.org/samples/${post.directory}/sample_${baseName}.jpg`;
                    } else {
                        imageUrl = `https://safebooru.org/images/${post.directory}/${post.image}`;
                    }
                } else {
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

                    // Show and enable ungenerate button
                    ungenerateBtn.classList.remove('hidden');
                    ungenerateBtn.disabled = false;

                    setLoadingState(false);
                };
                img.onerror = () => {
                    console.warn("Failed to load image from URL:", imageUrl);
                    if (retryCount < 3) {
                        console.log(`Retrying fetchRandomImage (Attempt ${retryCount + 1})...`);
                        fetchRandomImage(retryCount + 1);
                    } else {
                        showError();
                        setLoadingState(false);
                    }
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
        } else {
            spinner.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.querySelector('.btn-text').textContent = 'Generate Image';
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
        ungenerateBtn.disabled = true;
    }

    function showError() {
        errorMessage.classList.remove('hidden');
        errorMessage.style.position = 'relative';
        resultImage.classList.add('hidden');
        resultImage.style.position = 'absolute';
        imageInfo.classList.add('hidden');
        imageInfo.style.position = 'absolute';
        ungenerateBtn.classList.add('hidden');
        ungenerateBtn.disabled = true;
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.style.position = 'absolute';
    }

    // Event Listeners
    generateBtn.addEventListener('click', fetchRandomImage);
    ungenerateBtn.addEventListener('click', ungenerateImage);

    // Dynamically inject GIF toggle since index.html was locked
    const soundContainer = document.querySelector('.sound-toggle-container');
    if (soundContainer && topGif && !document.getElementById('gif-toggle')) {
        const gifToggleInput = document.createElement('input');
        gifToggleInput.type = 'checkbox';
        gifToggleInput.id = 'gif-toggle';
        gifToggleInput.checked = true;
        gifToggleInput.style.marginLeft = '15px';

        const gifToggleLabel = document.createElement('label');
        gifToggleLabel.htmlFor = 'gif-toggle';
        gifToggleLabel.textContent = 'Show GIF';

        soundContainer.appendChild(gifToggleInput);
        soundContainer.appendChild(gifToggleLabel);

        // Listeners for dynamic toggle
        gifToggleInput.addEventListener('change', (e) => {
            if (e.target.checked) {
                topGif.classList.remove('hidden');
            } else {
                topGif.classList.add('hidden');
            }
        });
    }

    // Dynamically inject disclaimer disclaimer since index.html was locked
    const mainContainer = document.querySelector('.container');
    if (mainContainer && !document.querySelector('.disclaimer-container')) {
        const discDiv = document.createElement('div');
        discDiv.className = 'disclaimer-container';
        discDiv.style.marginTop = '25px';
        discDiv.style.paddingTop = '15px';
        discDiv.style.borderTop = '1px solid #ccc';
        discDiv.style.textAlign = 'center';

        const p = document.createElement('p');
        p.style.fontSize = '11px';
        p.style.color = '#777';
        p.textContent = 'Note: If loading fails on your first visit (especially on mobile devices), please wait a moment and try clicking Generate Image again.';

        discDiv.appendChild(p);
        mainContainer.appendChild(discDiv);
    }

    // Initial setup Call
    init();
});
