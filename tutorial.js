document.addEventListener('DOMContentLoaded', () => {
    // --- Tutorial Setup ---

    const tutorialSteps = [
        {
            element: '#mainTitle',
            title: 'Welcome!',
            text: 'This webpage is used for understanding the city littering index for the City of Coral Gables. Let\'s take a quick tour of how to use the index.',
            position: 'bottom'
        },
        {
            element: '#viewDiv',
            title: 'Map',
            text: 'This map contains the litter index data for the City of Coral Gables.',
            position: 'bottom'
        },
        {
            element: '.esri-search__container',
            title: 'Search Bar',
            text: 'Use this search bar to find specific addresses or places on the map.',
            position: 'bottom'
        },
        {
            element: '.esri-zoom',
            title: 'Zoom Controls',
            text: 'Use these controls to zoom in and out of the map. You can also scroll with your mouse or click on specific zones on the map and select "Zoom To".',
            position: 'bottom'
        },
        {
            element: '#legendSidebar',
            title: 'Legend',
            text: 'Here you can find the legend, which explains the symbols and colors used on the map.',
            position: 'left'
        },
        {
            element: '#legendSidebar',
            title: 'Legend',
            text: 'The purple lines include the different road segments where the litter index was conducted in the City of Coral Gables.',
            position: 'left'
        },
        {
            element: '#legendSidebar',
            title: 'Legend',
            text: 'The red outline is the city boundary and the different colored polygons represent different zones within the city.',
            position: 'left'
        },
        {
            element: '#videoLinksSidebar',
            title: 'Video Player',
            text: 'This sidebar contains the links to videos from the different sites on the map.',
            position: 'right'
        },
        {
            element: '#videoLinksSidebar',
            title: 'Video Player',
            text: 'Videos are made annually. You can switch between years using the tabs.',
            position: 'right'
        },
        {
            element: '#videoLinksSidebar',
            title: 'Video Player',
            text: 'You can access the video links by clicking on the appropriate region. Try hovering over each button.',
            position: 'right'
        },
        {
            element: '#videoLinksSidebar',
            title: 'Video Player',
            text: 'Once a region is selected on the video player, a series of 10 site buttons will appear. Try hovering your mouse over the site buttons to highlight them on the map.',
            position: 'right'
        },
        {
            dynamicElement: () => {
                const activeTab = document.querySelector('.tab-switch:checked')?.parentElement.querySelector('.tab-content');
                if (!activeTab) return null;
                const headers = activeTab.querySelectorAll('.collapsible-header');
                for (const header of headers) {
                    if (header.firstChild.textContent.trim() === 'North Bird') {
                        return header.nextElementSibling.querySelector('.site button');
                    }
                }
                return null;
            },
            title: 'Play a Video',
            text: 'Let\'s see what happens if you click on a site button. Click "Next".',
            position: 'right'
        },
        {
            element: '#videoModal',
            title: 'Video Modal',
            text: 'Clicking a site button opens a video modal like this. The video displays the litter index for the selected site. You can close it by clicking the "×" or anywhere outside the video.',
            position: 'bottom'
        },
        {
            element: '#navbar',
            title: 'Navigation Bar',
            text: 'Use this navigation bar to access different websites relevant to this site.',
            position: 'bottom'
        },
        {
            title: 'You\'re all set to go!',
            text: 'Thanks for using the City of Coral Gables Litter Index. Have fun!',
            position: 'left'
        }
    ];

    let currentStep = 0;
    let previousStep = -1;
    let modalObserver = null;
    let highlightedElement = null;

    const overlay = document.getElementById('tutorial-overlay');
    const tutorialBox = document.getElementById('tutorial-box');
    const titleEl = tutorialBox.querySelector('h3');
    const textEl = tutorialBox.querySelector('p');
    const prevBtn = document.getElementById('tutorial-prev');
    const nextBtn = document.getElementById('tutorial-next');
    const viewDiv = document.getElementById('viewDiv');
    const videoLinksSidebar = document.getElementById('videoLinksSidebar');

    /**
     * Helper function to prevent all clicks outside of the tutorial box.
     * It captures the click event and stops it from propagating.
     * @param {MouseEvent} e The click event.
     */
    function preventAllClicksOutsideTutorial(e) {
        if (!e.target.closest('#tutorial-box')) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    function startTutorial() {
        currentStep = 0;
        previousStep = -1;
        overlay.style.display = 'block';
        tutorialBox.style.display = 'block';
        showStep(currentStep);

        // Close any accordion that might have been opened by the tutorial.
        if (typeof closeAllAccordions === 'function') {
            closeAllAccordions();
        }
    }

    function endTutorial() {
        overlay.style.display = 'none';
        tutorialBox.style.display = 'none';
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
            highlightedElement.style.pointerEvents = ''; // Reset any inline pointer-events style
            highlightedElement = null;
        }
        // Reset pointer events on the overlay
        overlay.style.pointerEvents = '';
        tutorialBox.style.pointerEvents = '';
        // Disconnect observer if tutorial is closed.
        if (modalObserver) {
            modalObserver.disconnect();
            modalObserver = null;
        }
        // Close any accordion that might have been opened by the tutorial.
        if (typeof closeAllAccordions === 'function') {
            closeAllAccordions();
        }
        // Also close the video modal if it was opened by the tutorial.
        if (typeof closeVideoModal === 'function') {
            closeVideoModal();
        }
        viewDiv.classList.remove('tutorial-highlight2');
        // Clean up the click prevention listener when the tutorial ends.
        document.removeEventListener('click', preventAllClicksOutsideTutorial, { capture: true });
    }

    function showStep(stepIndex) {
        // Reset pointer events at the start of each step.
        overlay.style.pointerEvents = '';
        tutorialBox.style.pointerEvents = '';

        // Clean up the global click prevention from the previous step.
        document.removeEventListener('click', preventAllClicksOutsideTutorial, { capture: true });

        // Disconnect any observer from a previous interactive step.
        if (modalObserver) {
            modalObserver.disconnect();
            modalObserver = null;
        }

        // Close the video modal if we are leaving the step that shows it (step 13, index 12).
        if (previousStep === 12 && typeof closeVideoModal === 'function') {
            closeVideoModal();
        }

        // Close the accordion when navigating away from the block of steps where it should be open (steps 10, 11, 12).
        // This happens when clicking "Previous" on step 10, or "Next" on step 12.
        if ((previousStep === 9 && stepIndex < 9) || (previousStep === 11 && stepIndex > 11)) {
            if (typeof closeAllAccordions === 'function') {
                closeAllAccordions();
            }
        }

        if (stepIndex < 0 || stepIndex >= tutorialSteps.length) {
            endTutorial();
            return;
        }

        // Update navigation buttons
        prevBtn.style.display = stepIndex === 0 ? 'none' : 'inline-block';
        nextBtn.style.display = stepIndex === tutorialSteps.length - 1 ? 'none' : 'inline-block';

        const step = tutorialSteps[stepIndex];

        // Special handling for step 13 (index 12) to show the video modal *before* positioning.
        if (stepIndex === 12) {
            // The function openVideoModal is in main.js and is global.
            // We get the video URL from the site button highlighted in the previous step.
            const siteButton = tutorialSteps[11].dynamicElement();
            if (siteButton) {
                const siteDiv = siteButton.closest('.site');
                if (siteDiv) {
                    const videoUrl = siteDiv.getAttribute('data-video-link');
                    if (videoUrl && typeof openVideoModal === 'function') {
                        openVideoModal(videoUrl);
                    }
                }
            }
        }

        // Remove previous highlight
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
            highlightedElement.style.pointerEvents = ''; // Reset any inline pointer-events style
        }

        // Update text
        titleEl.textContent = step.title;
        textEl.textContent = step.text;

        // Highlight new element
        if (step.dynamicElement) {
            highlightedElement = step.dynamicElement();
        } else {
            highlightedElement = document.querySelector(step.element);
        }

        if (highlightedElement) {
            highlightedElement.classList.add('tutorial-highlight');

            // Position the tutorial box, accounting for the highlighted element and viewport constraints.
            positionAndConstrainTutorialBox(highlightedElement, step.position);
        } else {
            // If there's no element to highlight, center the box.
            positionAndConstrainTutorialBox(null);
        }

        // Adds map to highlighted elements for steps 2-7
        if (stepIndex >= 1 && stepIndex <= 6) {
            viewDiv.classList.add('tutorial-highlight2');
        }

        // Removes map from highlighted elements for steps 2-7
        if (stepIndex < 1 || stepIndex > 6) {
            viewDiv.classList.remove('tutorial-highlight2');
        }

        // For steps 7 & 8 (indices 6, 7), the highlighted element is interactive but shouldn't be.
        // We disable pointer events on it directly. This prevents both hover and click.
        if (stepIndex === 7 || stepIndex === 8) {
            if (highlightedElement) {
                highlightedElement.style.pointerEvents = 'none';
            }
        }

        // Special handling for step 10 (index 9) and step 11 (index 10) to allow hover but not click.
        if (stepIndex == 9 || stepIndex == 10) {
            // Allow hover events to pass through the overlay for the map highlight effect.
            overlay.style.pointerEvents = 'none';
            // But keep the tutorial box itself clickable.
            tutorialBox.style.pointerEvents = 'auto';

            // Zoom map into relevant zone
            window.mapView.goTo({center: [-80.275, 25.749], zoom: 14});

            // Add a global listener to prevent all clicks outside the tutorial box.
            document.addEventListener('click', preventAllClicksOutsideTutorial, { capture: true });
        }

        // Returns zoom to original if "Previous" is selected on step 11 (index 10).
        if (stepIndex < 10) {
            window.mapView.goTo({
                center: [-80.27444569373124, 25.684506729852785],
                scale: 130000
            });
        }

        // Special handling for steps 11, 12, and 13 (indices 10, 11, 12) to OPEN the accordion.
        if (stepIndex >= 10 && stepIndex <= 12) {
            // The function toggleCollapse is in main.js and is global.
            // To ensure it's open, we check first.
            const activeTab = document.querySelector('.tab-switch:checked')?.parentElement.querySelector('.tab-content');
            if (activeTab) {
                const headers = activeTab.querySelectorAll('.collapsible-header');
                for (const header of headers) {
                    if (header.firstChild.textContent.trim() === 'North Bird') {
                        const content = header.nextElementSibling;
                        if (!content.classList.contains('open')) {
                            if (typeof toggleCollapse === 'function') {
                                toggleCollapse(header);
                            }
                        }
                        break; // Found it
                    }
                }
            }
        }

        // Adds highlight for videoLinksSidebar
        if (stepIndex === 11) {
            videoLinksSidebar.classList.add('tutorial-highlight2');
            document.addEventListener('click', preventAllClicksOutsideTutorial, { capture: true });
        }

        // Removes highlight for videoLinksSidebar
        if (stepIndex !== 11) {
            videoLinksSidebar.classList.remove('tutorial-highlight2');
        }
    }

    /**
     * Positions the tutorial box next to a target element, ensuring it stays within the viewport.
     * @param {HTMLElement} targetElement The element to position the box near.
     * @param {string} positionHint A hint for placement ('top', 'bottom', 'left', 'right').
     */
    function positionAndConstrainTutorialBox(targetElement, positionHint = 'right') {
        if (!targetElement) {
            // If no element, center the box (useful for the first step).
            tutorialBox.style.top = '50%';
            tutorialBox.style.left = '50%';
            tutorialBox.style.transform = 'translate(-50%, -50%)';
            return;
        }

        tutorialBox.style.transform = 'none'; // Reset transform if it was centered
        const targetRect = targetElement.getBoundingClientRect();
        const boxWidth = tutorialBox.offsetWidth;
        const boxHeight = tutorialBox.offsetHeight;
        const margin = 15; // Gap between element and box

        let top, left;

        // Calculate ideal position based on hint
        switch (positionHint) {
            case 'top': top = targetRect.top - boxHeight - margin; left = targetRect.left + (targetRect.width / 2) - (boxWidth / 2); break;
            case 'bottom': top = targetRect.bottom + margin; left = targetRect.left + (targetRect.width / 2) - (boxWidth / 2); break;
            case 'left': top = targetRect.top + (targetRect.height / 2) - (boxHeight / 2); left = targetRect.left - boxWidth - margin; break;
            case 'right': default: top = targetRect.top + (targetRect.height / 2) - (boxHeight / 2); left = targetRect.right + margin; break;
        }

        // Viewport collision correction
        const { innerWidth, innerHeight } = window;
        if (left + boxWidth > innerWidth - margin) left = innerWidth - boxWidth - margin;
        if (left < margin) left = margin;
        if (top + boxHeight > innerHeight - margin) top = innerHeight - margin - boxHeight;
        if (top < margin) top = margin;

        tutorialBox.style.top = `${top}px`;
        tutorialBox.style.left = `${left}px`;
    }

    // --- Event Listeners ---
    document.getElementById('start-tutorial-btn').addEventListener('click', startTutorial);
    document.getElementById('tutorial-close').addEventListener('click', endTutorial);
    prevBtn.addEventListener('click', () => {
        previousStep = currentStep;
        currentStep--;
        showStep(currentStep);
    });
    nextBtn.addEventListener('click', () => {
        previousStep = currentStep;
        currentStep++;
        showStep(currentStep);
    });
});