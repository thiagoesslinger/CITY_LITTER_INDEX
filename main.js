// --- ArcGIS API Setup ---
require([
    "esri/views/MapView",
    "esri/WebMap",
    "esri/widgets/Search",
    // "esri/widgets/BasemapToggle" // Import the BasemapToggle widget
], function(MapView, WebMap, Search, BasemapToggle) {
    const webmap = new WebMap({
        portalItem: { id: "c32b86b27541478caafe9f2f24df34bc" },
        basemap: "streets-vector"
    });
 
    const view = new MapView({
        container: "viewDiv",
        map: webmap,
        center: [-80.27444569373124, 25.684506729852785],
        scale: 130000
    });
 
    // Make the view accessible to global helper functions
    window.mapView = view;

    // Add Widgets
    view.ui.add(new Search({ view: view }), "top-right");

    // // Add the BasemapToggle widget to the bottom left of the view
    // const basemapToggle = new BasemapToggle({
    //     view: view,
    //     nextBasemap: "streets-vector" // The basemap to toggle to
    // });
    // view.ui.add(basemapToggle, "top-right");

 
    let highlightHandle = null;
    // Wait for the view to be ready before accessing layers
    view.when(async () => { // Make the callback function async
        // For debugging: Log all layers and their parents to the console.
        const allLayerInfo = webmap.allLayers.map(layer => `Title: '${layer.title}', Parent: '${layer.parent ? layer.parent.title : 'none'}'`).toArray();
        console.log("Available layers in the webmap:", allLayerInfo);

        // Find required layers using a helper function to reduce repetition.
        const featureLayer = findLayerByTitleAndParent(webmap, "Sites", "Litter_Index_Master_View");
        const zoneLayer = findLayerByTitleAndParent(webmap, "Area Average Index Value", "Litter_Index_Master_View");
        const scoreLayer = findLayerByTitleAndParent(webmap, "Score", "Litter_Index_Master_View");
 
        if (!featureLayer || !zoneLayer) {
            console.error("A critical layer ('Sites' or 'Area Average Index Value') could not be found. Aborting further setup.");
            return;
        }             
        
        // Ensure the featureLayer's properties (like fields) are loaded
        await featureLayer.load();

        // Populate the video links for the tabs from the feature layer.
        // The function now accepts the field's ALIAS (e.g., "Movie 2021") instead of its name.
        const num_of_tabs = featureLayer.fields.filter(f => f.alias.startsWith('Movie ')).length;
        let searchYear = 2021; // Start searching from 2021. This is defined outside the loop to track progress.

        // for-loop to add tabs based on how many movie fields are in the GIS layer
        for (let i = 1; i <= num_of_tabs; i++) {
            let alias_name;

            // This loop runs as long as the alias for the current 'searchYear' is NOT findable.
            // Its purpose is to find the next available year that has a "Movie" field, handling gaps like a missing 'Movie 2022'.
            while (!featureLayer.fields.find(f => f.alias === 'Movie ' + searchYear)) {
                searchYear++; // If not found, increment the year and check again.
            }

            if (i > 1) {
                createNewTab(searchYear, i); // Create the next tab if it's not the first one
            }

            // Once the loop exits, a valid alias has been found. We construct it and populate the tab.
            alias_name = 'Movie ' + searchYear;
            populateVideoLinksForTab(featureLayer, 'tab' + i, alias_name);
            searchYear++; // Increment so the next 'for' loop iteration starts searching from the next year.
        }

        // For debugging: log the found layer to the console to ensure it's the correct one.
        console.log("Found feature layer for highlighting:", featureLayer.title);
        featureLayer.popupEnabled = false;

        // Get the LayerView for the feature layer. This is used for highlighting.
        view.whenLayerView(featureLayer).then(layerView => {
            // Optional: You can customize the highlight appearance here
            layerView.highlightOptions = {
                color: [255, 255, 0, 1], // Yellow highlight color
                haloOpacity: 0.9,
                fillOpacity: 0.7
            };
 
            // Function to clear the highlight
            const clearHighlight = () => {
                if (highlightHandle) {
                    highlightHandle.remove();
                    highlightHandle = null;
                }
            };
 
            // Use event delegation on the sidebar to handle events for dynamically added buttons.
            const videoLinksSidebar = document.getElementById('videoLinksSidebar');
            videoLinksSidebar.addEventListener('mouseover', (event) => {
                const siteElement = event.target.closest('.site');
                if (siteElement) {
                    const objectId = siteElement.dataset.objectId;
                    if (objectId) {
                        if (highlightHandle) highlightHandle.remove();
                        highlightHandle = layerView.highlight(parseInt(objectId));
                    }
                }
            });

            videoLinksSidebar.addEventListener('mouseout', (event) => {
                if (event.target.closest('.site')) {
                    clearHighlight();
                }
            });
        }).catch(error => console.error("Error getting layer view:", error));

        // Configure the found layers
        console.log("Found zone layer for popup configuration:", zoneLayer.title);
        zoneLayer.outFields = ["AreaName"]; // Explicitly request attributes for the custom popup
        zoneLayer.popupEnabled = false;

        if (scoreLayer) {
            console.log("Found score layer for popup configuration:", scoreLayer.title);
            scoreLayer.popupEnabled = false; // Disable popups entirely for the score layer
        }

        // --- Custom Cursor on Zone Hover ---
        // Changes the cursor to a pointer when hovering over a clickable zone feature.
        view.on("pointer-move", (event) => {
            view.hitTest(event).then((response) => {
                // Find a graphic from the zoneLayer in the hitTest results
                const graphicResult = response.results.find(r => r.graphic && r.graphic.layer === zoneLayer);

                if (graphicResult) {
                    view.container.style.cursor = "pointer";
                } else {
                    view.container.style.cursor = "default";
                }
            });
        });

        // --- Custom Popup Logic ---
        const zoneColorMap = {
            "North Bird": "rgb(158,58,156)",
            "East LeJeune": "rgb(20,158,206)",
            "South Bird": "rgb(167,198,54)",
            "South US 1": "rgb(237,81,81)",
            "South Sunset": "rgb(237,81,81)"
        };
        const customPopup = document.getElementById("custom-popup");

        // Hide the custom popup when the map is dragged or zoomed
        view.on("drag", () => {
            if (customPopup.style.display !== "none") customPopup.style.display = "none";
        });
        view.watch("zooming", (isZooming) => {
            if (isZooming && customPopup.style.display !== "none") customPopup.style.display = "none";
        });

        // Listen for click events on the view to implement the custom popup
        view.on("click", (event) => {
            customPopup.style.display = "none"; // Hide popup for any click

            view.hitTest(event).then((response) => {
                // Find the first result that is a graphic from our target zone layer
                const graphicResult = response.results.find(r => r.graphic && r.graphic.layer === zoneLayer);

                if (graphicResult) {
                    window.currentClickedGraphic = graphicResult.graphic;
                    const graphic = window.currentClickedGraphic;

                    // Clear previous content and build the new popup dynamically
                    customPopup.innerHTML = '';
                    const contentContainer = document.createElement('div');
                    contentContainer.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 8px;";

                    const buttonContainer = document.createElement('div');
                    buttonContainer.style.cssText = "display: flex; gap: 8px;";

                    // Create title
                    const zoneName = graphic.attributes['AreaName'];
                    const zoneColor = zoneColorMap[zoneName] || 'black';

                    // // Set the border color of the popup to match the zone color
                    // customPopup.style.borderColor = zoneColor;

                    const titleElement = document.createElement('span');
                    titleElement.textContent = zoneName;
                    titleElement.style.fontSize = '1.1em';
                    titleElement.style.color = zoneColor; // Set text color based on zone

                    // Create buttons using a helper function to reduce repetition
                    const zoomButton = createPopupButton('Zoom To', zoneColor, zoomToCurrentGraphic);
                    const viewSitesButton = createPopupButton('View Videos', zoneColor, () => openAccordionForZone(zoneName));

                    // Assemble the popup
                    buttonContainer.appendChild(zoomButton);
                    buttonContainer.appendChild(viewSitesButton);
                    contentContainer.appendChild(titleElement);
                    contentContainer.appendChild(buttonContainer);
                    customPopup.appendChild(contentContainer);

                    // Set CSS variables for positioning. The actual position is calculated in CSS.
                    customPopup.style.setProperty('--popup-left', `${event.x}px`);
                    customPopup.style.setProperty('--popup-top', `${event.y}px`);
                    customPopup.style.display = "block";
                }
            });
        });
    }).catch(error => console.error("MapView failed to load:", error));
});

/**
 * Populates the `data-video-link` for all site buttons within a specific tab.
 * It queries the feature layer to get the correct video URL for each button
 * based on its `data-object-id`.
 * @param {esri.layers.FeatureLayer} layer The feature layer to query.
 * @param {string} tabId The ID of the tab element (e.g., 'tab1').
 * @param {string} movieFieldAlias The alias of the field containing the video URLs (e.g., 'Movie 2021').
 */
function populateVideoLinksForTab(layer, tabId, movieFieldAlias) {
    const tabInputElement = document.getElementById(tabId);
    if (!tabInputElement) {
        console.error(`Could not find tab with ID: ${tabId}`);
        return;
    }
    const tabContent = tabInputElement.parentElement.querySelector('.tab-content');
    const siteElements = tabContent.querySelectorAll('.site');
    // Filter the list of IDs to remove any empty or invalid values.
    // This prevents a malformed query like "OBJECTID IN (1,2,,4)".
    // This robustly filters for non-empty, numeric IDs to prevent query errors.
    const objectIds = Array.from(siteElements)
        .map(site => site.dataset.objectId)
        .filter(id => id && id.trim() !== '' && !isNaN(Number(id)));

    if (objectIds.length === 0) {
        return; // No sites to update
    }

    // Use layer.when() to ensure the layer is fully loaded and ready for querying.
    // This prevents race conditions where a query is sent before the layer is initialized.
    layer.when(() => {
        // --- Field Lookup by Alias ---
        // Find the field object that matches the provided alias.
        const targetField = layer.fields.find(field => field.alias === movieFieldAlias);

        if (!targetField) {
            // If no field with that alias is found, log a detailed error and stop.
            const availableAliases = layer.fields.map(f => `'${f.alias}' (name: ${f.name})`).join(', ');
            console.error(`CRITICAL: The field with alias '${movieFieldAlias}' does not exist on the layer '${layer.title}'. Please check the alias. Available aliases: [${availableAliases}]`);
            return; // Stop if the field is wrong
        }

        // Get the actual field name to use in the query.
        const actualFieldName = targetField.name;
        const oidField = layer.objectIdField;

        // Query the feature layer for the video links for the specified sites
        layer.queryFeatures({
            where: `${oidField} IN (${objectIds.join(',')})`,
            outFields: [oidField, actualFieldName],
            returnGeometry: false
        }).then(featureSet => {
            const urlMap = new Map();
            featureSet.features.forEach(feature => {
                urlMap.set(feature.attributes[oidField].toString(), feature.attributes[actualFieldName]);
            });

            siteElements.forEach(site => {
                const videoLink = urlMap.get(site.dataset.objectId);
                if (videoLink) site.setAttribute('data-video-link', videoLink);
            });
        }).catch(error => {
            console.error(`Error during queryFeatures for field with alias '${movieFieldAlias}' (name: '${actualFieldName}'):`, error);
        });
    }).catch(error => {
        console.error(`Layer '${layer.title}' failed to load for querying:`, error);
    });
}

/**
 * Creates and appends a '2022' tab by cloning the existing '2021' tab structure.
 * This function prepares the new tab but does not populate it with new data.
 * The video links are cleared, awaiting dynamic population from a feature layer.
 */
// Inputs: i.e. year=2022, num=2 (for tab2)
function createNewTab(year,num) {
    const tabsContainer = document.querySelector('#videolinks-tabs');
    // The first tab is assumed to be the template (2021)
    const templateTab = tabsContainer ? tabsContainer.querySelector('.tab') : null;

    if (!templateTab) {
        console.error("Could not find the template tab to create the", year, " tab.");
        return;
    }

    const newTab = templateTab.cloneNode(true);

    // --- Update IDs and content for the new tab ---

    // 1. Update the radio button input
    const newRadio = newTab.querySelector('.tab-switch');
    if (newRadio) {
        newRadio.id = 'tab' + num; // A new unique ID for the tab switch
        newRadio.checked = false; // Ensure the new tab is not active by default
    }

    // 2. Update the label
    const newLabel = newTab.querySelector('.tab-label');
    if (newLabel) {
        newLabel.setAttribute('for', 'tab' + num); // Link label to the new radio button
        newLabel.textContent = year;
    }
    
    // 3. Clear year-specific data from the cloned content
    const newContent = newTab.querySelector('.tab-content');
    if (newContent) {
        // The data-object-id is preserved, but the video link is cleared.
        // It will need to be populated dynamically with new year data.
        newContent.querySelectorAll('.site').forEach(site => {
            site.setAttribute('data-video-link', '');
        });
    }

    // Append the fully constructed new tab to the DOM
    tabsContainer.appendChild(newTab);
}


/**
 * Finds a layer in the webmap by its title and its parent's title.
 * This is a helper function to avoid repeating the same find logic.
 * @param {esri.WebMap} webmap The webmap instance.
 * @param {string} title The title of the layer to find.
 * @param {string} parentTitle The title of the parent group layer.
 * @returns {esri.layers.Layer|null} The found layer or null.
 */
function findLayerByTitleAndParent(webmap, title, parentTitle) {
    const layer = webmap.allLayers.find(l => {
        return l.title === title && l.parent && l.parent.title === parentTitle;
    });

    if (!layer) {
        console.error(`ERROR: Could not find the '${title}' layer inside the '${parentTitle}' group layer. Please check layer and group titles.`);
    }
    return layer;
}

/**
 * Creates a styled button for the custom map popup.
 * This is a helper function to avoid repeating button creation logic.
 * @param {string} text The button's text content.
 * @param {string} color The CSS color for the button's text.
 * @param {Function} onClick The function to execute on click.
 * @returns {HTMLButtonElement} The created button element.
 */
function createPopupButton(text, color, onClick) {
    const button = document.createElement('button');
    button.className = 'popup-button';
    button.textContent = text;
    button.style.color = color;
    button.addEventListener('click', onClick);
    return button;
}
 
/**
 * Helper function to create a delay.
 * @param {number} ms Milliseconds to wait.
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Orchestrates the animation for switching between tabs.
 * 1. Fades out old tab's items from bottom to top.
 * 2. Transitions the background color.
 * 3. Fades in new tab's items from top to bottom.
 * @param {HTMLElement | null} oldTabContent The content element of the tab being switched away from.
 * @param {HTMLElement} newTabContent The content element of the tab being switched to.
 * @param {HTMLElement} animationContainer The parent container to lock during animation.
 */
async function handleTabSwitchAnimation(oldTabContent, newTabContent, animationContainer, direction = 'forward') {
    if (!newTabContent) return;

    // Prevent further tab clicks during animation
    animationContainer.classList.add('animating');

    // If there was no previously visible tab (e.g., on first load), just show the new one without animation.
    if (!oldTabContent) {
        newTabContent.classList.add('visible');
        animationContainer.classList.remove('animating');
        return;
    }

    const outClass = direction === 'forward' ? 'animating-out' : 'animating-out-reverse';
    const inClass = direction === 'forward' ? 'animating-in' : 'animating-in-reverse';

    // --- 1. Animate Out Old Items ---
    const oldCollapsibles = Array.from(oldTabContent.querySelectorAll('.collapsible-container'));
    for (const item of oldCollapsibles.reverse()) { // bottom to top
        item.classList.add(outClass);
        await wait(100);
    }

    // --- 2. Switch Tabs ---
    // Hide old tab. The opacity transition will handle the fade.
    oldTabContent.classList.remove('visible');
    
    // --- 3. Prepare and Show New Tab ---
    const newCollapsibles = Array.from(newTabContent.querySelectorAll('.collapsible-container'));
    // Instantly set items to their "in" state (hidden) before the tab becomes visible
    newCollapsibles.forEach(item => item.classList.add(inClass));
    // Show new tab. The opacity transition will handle the fade-in.
    newTabContent.classList.add('visible');

    // Force a browser reflow to ensure 'animating-in' styles are applied before we remove the class.
    newTabContent.getBoundingClientRect();

    // --- 4. Animate In New Items ---
    for (const item of newCollapsibles) { // Animate in new items from top to bottom
        item.classList.remove(inClass);
        await wait(100);
    }

    // --- 5. Cleanup ---
    oldCollapsibles.forEach(item => item.classList.remove(outClass));
    animationContainer.classList.remove('animating'); // Allow tab clicks again
}

// --- UI Interaction and Helper Functions ---
 
/**
 * Zooms the map to the graphic that was last clicked to open the custom popup.
 */
function zoomToCurrentGraphic() {
    if (window.currentClickedGraphic && window.mapView) {
        window.mapView.goTo(window.currentClickedGraphic);
        document.getElementById('custom-popup').style.display = 'none';
    }
}

/**
 * Converts a standard YouTube watch URL to an embeddable URL.
 * @param {string} url The original YouTube URL.
 * @returns {string} The embeddable YouTube URL with autoplay.
 */
function convertToEmbedURL(url) {
    if (!url) return "";
    try {
        const urlObj = new URL(url);
        const videoId = urlObj.searchParams.get('v');
        return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } catch (error) {
        console.error("Invalid video URL:", url, error);
        return "";
    }
}
 
/**
 * Opens the video modal and plays the selected video.
 * @param {string} videoUrl The standard YouTube watch URL.
 */
function openVideoModal(videoUrl) {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoFrame');
    if (modal && iframe) {
        iframe.src = convertToEmbedURL(videoUrl);
        modal.style.display = 'block';
    }
}
 
/**
 * Closes the video modal and stops video playback.
 */
function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoFrame');
    if (modal && iframe) {
        modal.style.display = 'none';
        iframe.src = ''; // Stop video playback
    }
}
 
/**
 * Switches between tabs in a tabbed interface.
 * @param {Event} evt The click event.
 * @param {string} tabName The ID of the tab content to show.
 */
function openTab(evt, tabName) {
    // Close any open accordions before switching tabs.
    closeAllAccordions();

    // Hide all tab content
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.style.display = "none";
        tab.classList.remove("active");
    });
 
    // Deactivate all tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("active");
    });
 
    // Show the selected tab and activate its button
    const activeTab = document.getElementById(tabName);
    if (activeTab) {
        activeTab.style.display = "block";
        activeTab.classList.add("active");
    }
    if (evt.currentTarget) {
        evt.currentTarget.classList.add("active");
    }
}
 
/**
 * Finds and expands the correct accordion in the sidebar for a given zone name.
 * @param {string} zoneName The name of the zone to find.
 */

function openAccordionForZone(zoneName) {
    // Find the active tab's content. It first checks for the CSS-based tab system (a checked radio button)
    // and falls back to the JS-based system (an element with the .active class).
    let activeTab = null;
    const checkedSwitch = document.querySelector('.tab-switch:checked');
    if (checkedSwitch) {
        // For CSS-based tabs, the content is inside the same parent .tab container.
        activeTab = checkedSwitch.parentElement.querySelector('.tab-content');
    } else {
        // For JS-based tabs, the content has an 'active' class.
        activeTab = document.querySelector('.tab-content.active');
    }

    if (!activeTab) {
        console.error("Could not find an active tab.");
        return;
    }

    const headers = activeTab.querySelectorAll('.collapsible-header');
    let targetHeader = null;
    for (const header of headers) {
        // The first child of the header is the text node containing the name.
        const headerText = header.firstChild.textContent.trim();
        if (headerText === zoneName) {
            targetHeader = header;
            break;
        }
    }

    if (targetHeader) toggleCollapse(targetHeader);
    else console.error(`Could not find an accordion header for zone: ${zoneName}`);
    
    document.getElementById('custom-popup').style.display = 'none';
}

/**
 * Toggles the visibility of a collapsible content section.
 * @param {HTMLElement} header The header element that was clicked.
 */
function toggleCollapse(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    const isOpening = !content.classList.contains('open'); // Check if we intend to open this section.

    // First, close all currently open sections to ensure a clean state.
    document.querySelectorAll('.collapsible-content.open').forEach(openContent => {
        openContent.style.maxHeight = null;
        openContent.classList.remove('open');
        const otherIcon = openContent.previousElementSibling.querySelector('.toggle-icon');
        if (otherIcon) {
            otherIcon.style.transform = 'rotate(0deg)';
        }
    });
 
    // If we are opening a new section (i.e., it wasn't already open), open it.
    // This creates the classic "accordion" effect where clicking an open one closes it.
    if (isOpening) {
        content.classList.add('open');
        content.style.maxHeight = content.scrollHeight + "px";
        if (icon) icon.style.transform = 'rotate(90deg)';
    }

    // After toggling, update the sidebar's height.
    updateSidebarHeight();
}

/**
 * Finds and closes all open accordion sections. This is typically called when switching tabs.
 */
function closeAllAccordions() {
    document.querySelectorAll('.collapsible-content.open').forEach(openContent => {
        openContent.style.maxHeight = null;
        openContent.classList.remove('open');
        const icon = openContent.previousElementSibling.querySelector('.toggle-icon');
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    });
    // After closing all accordions, reset the sidebar height.
    updateSidebarHeight();
}

/**
 * Adjusts the sidebar height. If an accordion is open, it expands just enough
 * to show all accordion headers, capped at 87vh. The content inside the
 * open accordion will scroll if necessary. If all are closed, it shrinks.
 */
function updateSidebarHeight() {
    const sidebar = document.getElementById('videoLinksSidebar');
    const sidebar_tabs = document.getElementById('videolinks-tabs');
    const wrapper = sidebar ? sidebar.querySelector('.wrapper') : null;

    if (!sidebar || !wrapper) {
        console.error("Sidebar or wrapper element not found. Cannot update height.");
        return;
    }

    const openContent = wrapper.querySelector('.collapsible-content.open');

    if (openContent) {
        sidebar.classList.add('expanded');
        sidebar_tabs.classList.add('expanded');
    } else {
        sidebar.classList.remove('expanded');
        sidebar_tabs.classList.remove('expanded');
        // Revert to the default collapsed height defined in the CSS.
        sidebar.style.maxHeight = null;
        sidebar_tabs.style.maxHeight = null;
    }
}
     
// --- Main Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the first tab to be visible
    const firstTab = document.getElementById('tab1');
    if (firstTab) {
        firstTab.style.display = 'block';
    }

    // --- Mobile Navigation & Sidebar Toggles ---
    const navbarToggler = document.getElementById('navbar-toggler-btn');
    const navLinks = document.querySelector('.nav-links');
    const videoSidebar = document.getElementById('videoLinksSidebar');
    const legendSidebar = document.getElementById('legendSidebar');
    const videoSidebarToggler = document.getElementById('toggle-video-sidebar');
    const legendSidebarToggler = document.getElementById('toggle-legend-sidebar');

    if (navbarToggler && navLinks) {
        navbarToggler.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    if (videoSidebarToggler && videoSidebar && legendSidebarToggler && legendSidebar) {
        videoSidebarToggler.addEventListener('click', () => {
            // Always close the other sidebar before toggling this one.
            legendSidebar.classList.remove('open');
            videoSidebar.classList.toggle('open');
        });
    
        legendSidebarToggler.addEventListener('click', () => {
            // Always close the other sidebar before toggling this one.
            // This also ensures that if an accordion is open in the video sidebar, it closes.
            videoSidebar.classList.remove('open');
            legendSidebar.classList.toggle('open');
        });
    }

    const tabsContainer = document.getElementById('videolinks-tabs');
    if (tabsContainer) {
        // The 'change' event on the container will fire when a radio button is selected.
        tabsContainer.addEventListener('change', (event) => {
            if (event.target.classList.contains('tab-switch')) {
                // Find the previously selected tab content.
                const oldTabContent = Array.from(tabsContainer.querySelectorAll('.tab-content')).find(tc => tc.classList.contains('visible'));
                const newTabContent = event.target.parentElement.querySelector('.tab-content');

                if (newTabContent === oldTabContent || tabsContainer.classList.contains('animating')) {
                    return;
                }
                
                // Determine animation direction by comparing the indices of the old and new tabs.
                const allTabs = Array.from(tabsContainer.querySelectorAll('.tab'));
                const oldTabElement = oldTabContent?.closest('.tab'); // Use optional chaining in case it's null
                const newTabElement = newTabContent.closest('.tab');

                const oldIndex = oldTabElement ? allTabs.indexOf(oldTabElement) : -1;
                const newIndex = allTabs.indexOf(newTabElement);
                
                // If newIndex > oldIndex, we're moving forward (e.g., 2021 -> 2022)
                const direction = newIndex > oldIndex ? 'forward' : 'backward';
                
                // Close any open accordions before starting the animation.
                closeAllAccordions();

                handleTabSwitchAnimation(oldTabContent, newTabContent, tabsContainer, direction);
            }
        });
    }
 
    // Use event delegation to handle clicks on site buttons, including those added dynamically.
    // This listener is attached to a static parent element (`#videoLinksSidebar`).
    // videoSidebar is already declared above, reuse it.
    if (videoSidebar) {
        videoSidebar.addEventListener('click', (event) => {
            const siteElement = event.target.closest('.site');
            if (siteElement) {
                const videoUrl = siteElement.getAttribute('data-video-link');
                openVideoModal(videoUrl);
            }
        });
    }
 
    // Add click listener for the modal's close button
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeVideoModal);
    }

    // --- Help Modal Logic ---
    const helpModal = document.getElementById('helpModal');
    const helpBtn = document.getElementById('help-popup-btn');
    const helpModalCloseBtn = document.getElementById('helpModalClose');

    if (helpBtn && helpModal && helpModalCloseBtn) {
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent link from navigating
            helpModal.style.display = 'block';
        });

        helpModalCloseBtn.addEventListener('click', () => {
            helpModal.style.display = 'none';
        });

        // Also close when clicking outside the modal content
        window.addEventListener('click', (event) => {
            if (event.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });
    }
 
    // Add click listener to close the modal when clicking on the background
    window.addEventListener('click', event => {
        const modal = document.getElementById('videoModal');
        if (event.target === modal) {
            closeVideoModal();
        }
    });
 
    // Note: The 'toggleCollapse' and 'openTab' functions are called directly
    // from the onclick attributes in the HTML, so they don't need listeners here.
    // The highlighting listeners are added in the ArcGIS `require` block.
    // Ensure the initially checked tab's content is visible on page load
    const initialCheckedTabSwitch = document.querySelector('.tab-switch:checked');
    if (initialCheckedTabSwitch) {
        const initialTabContent = initialCheckedTabSwitch.parentElement.querySelector('.tab-content');
        if (initialTabContent) {
            initialTabContent.classList.add('visible');
        }
    }

    // Note: The 'toggleCollapse' function is called directly from the onclick attributes in the HTML.
});