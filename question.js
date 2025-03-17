// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Define our data structure
    const surgicalData = {
        departments: [
            { id: "general", name: "General", description: "Focuses on a broad range of procedures, including the areas like the digestive tract and emergency procedures like appendectomies." },
            { id: "gynecology", name: "Gynecology", description: "Surgical procedures related to the female reproductive system, including hysterectomies and ovarian surgeries." },
            { id: "thoracic", name: "Thoracic", description: "Deals with operations on the chest, including the lungs, esophagus, and heart." },
            { id: "urology", name: "Urology", description: "Focuses on surgical and medical treatment of the urinary tract and male reproductive system, including kidney stones, prostate surgery, and bladder issues." }
        ],
        surgeryTypes: [
            { id: "open", name: "Open", description: "The more traditional form of surgery, where surgeons cut into patients to perform an operation." },
            { id: "videoscopic", name: "Videoscopic", description: "Surgery using a small scope to project a magnified image of the body onto a larger monitor to assist surgeons." },
            { id: "robotic", name: "Robotic", description: "A more experimental procedure involving robotic assistance during the operation." }
        ],
        // Cache for calculated outcomes
        _cachedOutcomes: null,
        
        // Method to clear the cache and force a refresh
        clearCache: function() {
            console.log("Clearing outcomes cache");
            this._cachedOutcomes = null;
        },
        
        calculateOutcomes: async function() {
            // If we already have calculated outcomes, return them
            if (this._cachedOutcomes) {
                console.log("Using cached outcomes data");
                return this._cachedOutcomes;
            }
            
            // Convert caseend from minutes to days
            const MINUTES_PER_DAY = 1440;
            
            // Group cases by surgery type
            const casesByType = {
                open: [],
                videoscopic: [],
                robotic: []
            };

            try {
                // Read and process cases.csv
                let data;
                // Try to fetch the data with retries
                const maxRetries = 3;
                let retryCount = 0;
                let fetchError = null;
                
                while (retryCount < maxRetries) {
                    try {
                        console.log(`Attempting to fetch CSV data (attempt ${retryCount + 1}/${maxRetries})...`);
                        const response = await fetch('cases.csv');
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        data = await response.text();
                        console.log("CSV data fetched successfully");
                        fetchError = null;
                        break;
                    } catch (error) {
                        fetchError = error;
                        console.error(`Error fetching CSV file (attempt ${retryCount + 1}/${maxRetries}):`, error);
                        retryCount++;
                        // Wait before retrying (exponential backoff)
                        if (retryCount < maxRetries) {
                            const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000);
                            console.log(`Waiting ${waitTime}ms before retrying...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                }
                
                // If all fetch attempts failed, throw the last error
                if (fetchError) {
                    throw fetchError;
                }
                // Process the CSV data
                console.log("Processing CSV data...");
                const rows = data.split('\n');
                
                // Check if we have data to process
                if (rows.length <= 1) {
                    throw new Error("CSV file is empty or contains only headers");
                }
                
                // Get header row to identify column indices
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                
                // Based on the actual CSV structure:
                // - 'optype' is the surgery type (column 20)
                // - 'death_inhosp' is the death indicator (column 11)
                // - 'caseend' is the recovery time (column 3)
                const surgeryTypeIndex = headers.indexOf('optype');
                const deathIndex = headers.indexOf('death_inhosp');
                const recoveryTimeIndex = headers.indexOf('caseend');
                
                console.log("Found column indices:", {
                    surgeryType: surgeryTypeIndex,
                    death: deathIndex,
                    recoveryTime: recoveryTimeIndex
                });
                
                // Validate that we found the required columns
                if (surgeryTypeIndex === -1 || deathIndex === -1 || recoveryTimeIndex === -1) {
                    console.error("Required columns not found in CSV:", {
                        headers,
                        surgeryTypeIndex,
                        deathIndex,
                        recoveryTimeIndex
                    });
                    throw new Error("CSV file is missing required columns");
                }
                
                // Process data rows
                rows.slice(1).forEach(row => {
                    if (!row.trim()) return; // Skip empty rows
                    
                    const columns = row.split(',');
                    // Make sure we have enough columns
                    if (columns.length <= Math.max(surgeryTypeIndex, deathIndex, recoveryTimeIndex)) {
                        console.warn("Skipping row with insufficient columns:", row);
                        return;
                    }
                    
                    // Get the surgery type from the CSV and map it to our expected categories
                    let rawSurgeryType = columns[surgeryTypeIndex] ? columns[surgeryTypeIndex].toLowerCase().trim() : null;
                    let surgeryType = null;
                    
                    // Map the surgery approach to our categories
                    const approach = columns[headers.indexOf('approach')] ? columns[headers.indexOf('approach')].toLowerCase().trim() : '';
                    
                    if (approach === 'open') {
                        surgeryType = 'open';
                    } else if (approach === 'videoscopic') {
                        surgeryType = 'videoscopic';
                    } else if (approach.includes('robot')) {
                        surgeryType = 'robotic';
                    } else {
                        // Default to open if approach is not specified
                        surgeryType = 'open';
                    }
                    
                    const death = parseInt(columns[deathIndex]) || 0;
                    const recoveryMinutes = parseInt(columns[recoveryTimeIndex]) || 0;
                    const recoveryDays = recoveryMinutes / MINUTES_PER_DAY;
                    
                    if (surgeryType && casesByType[surgeryType]) {
                        casesByType[surgeryType].push({
                            death,
                            recoveryDays,
                            department: columns[headers.indexOf('department')] || '',
                            rawSurgeryType
                        });
                    }
                });
                
                // Log the number of cases processed for each type
                Object.entries(casesByType).forEach(([type, cases]) => {
                    console.log(`Processed ${cases.length} cases for ${type} surgery`);
                    
                    // Log sample data for debugging
                    if (cases.length > 0) {
                        console.log(`Sample case for ${type}:`, cases[0]);
                    }
                    
                    // Log departments found for each surgery type
                    const departments = [...new Set(cases.map(c => c.department))];
                    console.log(`Departments for ${type} surgery:`, departments);
                });
                
                // Check if we have any data at all
                const totalCases = Object.values(casesByType).reduce((sum, cases) => sum + cases.length, 0);
                if (totalCases === 0) {
                    console.warn("No valid cases found in the CSV file");
                }

                // Calculate statistics for each surgery type
                const outcomes = {};
                for (const [type, cases] of Object.entries(casesByType)) {
                    const totalCases = cases.length;
                    if (totalCases === 0) {
                        console.warn(`No cases found for ${type} surgery type`);
                        outcomes[type] = {
                            death: "0.0",
                            recovery: {
                                within3days: "0.0",
                                within3to7days: "0.0",
                                over7days: "0.0"
                            }
                        };
                        continue;
                    }

                    const deaths = cases.filter(c => c.death === 1).length;
                    const recoveryTimes = cases.filter(c => c.death === 0).map(c => c.recoveryDays);
                    
                    outcomes[type] = {
                        death: ((deaths / totalCases) * 100).toFixed(1),
                        recovery: {
                            within3days: ((recoveryTimes.filter(d => d <= 3).length / totalCases) * 100).toFixed(1),
                            within3to7days: ((recoveryTimes.filter(d => d > 3 && d <= 7).length / totalCases) * 100).toFixed(1),
                            over7days: ((recoveryTimes.filter(d => d > 7).length / totalCases) * 100).toFixed(1)
                        }
                    };
                }
                
                // Cache the calculated outcomes
                this._cachedOutcomes = outcomes;
                console.log("Outcomes calculated successfully:", outcomes);
                return outcomes;
            } catch (error) {
                console.error('Error processing cases data:', error);
                
                // Instead of generating synthetic data, we'll return empty data
                // to indicate that real data couldn't be loaded
                console.log("Unable to process CSV data. No fallback data will be used.");
                
                const emptyData = {
                    open: {
                        death: "N/A",
                        recovery: {
                            within3days: "N/A",
                            within3to7days: "N/A",
                            over7days: "N/A"
                        }
                    },
                    videoscopic: {
                        death: "N/A",
                        recovery: {
                            within3days: "N/A",
                            within3to7days: "N/A",
                            over7days: "N/A"
                        }
                    },
                    robotic: {
                        death: "N/A",
                        recovery: {
                            within3days: "N/A",
                            within3to7days: "N/A",
                            over7days: "N/A"
                        }
                    }
                };
                
                // Cache the empty outcomes
                this._cachedOutcomes = emptyData;
                return emptyData;
            }
        }
    };

    // Current state of questionnaire
    let currentState = {
        started: false, // Flag to check if quiz has started
        quizStep: 1,
        department: null,
        surgeryType: null
    };
/*
    // Create a container for the questionnaire content if it doesn't exist
    if (!document.querySelector('.questionnaire-section')) {
        const questionnaireSection = document.createElement('div');
        questionnaireSection.classList.add('questionnaire-section');
        
        const questionnaireContainer = document.createElement('div');
        questionnaireContainer.id = 'questionnaire-container';
        
        questionnaireSection.appendChild(questionnaireContainer);
        
        // Insert the questionnaire section at the top of the page
        const mainContainer = document.querySelector('.container');
        document.body.insertBefore(questionnaireSection, mainContainer);
    }
*/
    // Get DOM elements
    const questionnaireContainer = document.getElementById('questionnaire-container');
    const resetBtn = document.getElementById('resetBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const quizStepButtons = document.querySelectorAll('.steps');

    // Initialize the questionnaire
    initQuestionnaire();

    // Set up event listeners
    resetBtn.addEventListener('click', resetQuestionnaire);
    prevBtn.addEventListener('click', goToPreviousStep);
    nextBtn.addEventListener('click', goToNextStep);
    quizStepButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            goToStep(index + 1);
        });
    });

    // Functions to manage the questionnaire
    function initQuestionnaire() {
        // Show start page first
        showStartPage();
        // updateQuizButtonStates();
    }

    function resetQuestionnaire() {
        currentState = {
            started: false,
            quizStep: 1,
            department: null,
            surgeryType: null
        };
        showStartPage();
        // updateQuizButtonStates();
    }

    function goToStep(quizStep) {
        if (quizStep === currentState.quizStep && currentState.started) return;

        // TANYA: the quiz would start when interacting with Sankey, I think the problem came form here
        // // If quiz hasn't started yet, we need to start it first
        // if (!currentState.started) {
        //     startQuiz();
        //     return;
        // }

        if (quizStep === 1) {
            currentState.quizStep = 1;
            currentState.department = null;
            currentState.surgeryType = null;
            showDepartmentSelection();
        } else if (quizStep === 2 && currentState.department) {
            currentState.quizStep = 2;
            currentState.surgeryType = null;
            showSurgeryTypeSelection();
        } else if (quizStep === 3 && currentState.department && currentState.surgeryType) {
            currentState.quizStep = 3;
            showResults();
        }

        updateStepIndicator(currentState.quizStep);
        // updateQuizButtonStates();
    }

    function goToPreviousStep() {
        if (currentState.quizStep > 1) {
            goToStep(currentState.quizStep - 1);
        }
    }

    function goToNextStep() {
        if (currentState.quizStep < 3) {
            goToStep(currentState.quizStep + 1);
        }
    }

    function updateStepIndicator(quizStep) {
        quizStepButtons.forEach((btn, index) => {
            if (index + 1 === quizStep) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // function updateQuizButtonStates() {
    //     // If quiz hasn't started, disable all navigation buttons
    //     if (!currentState.started) {
    //         prevBtn.disabled = true;
    //         nextBtn.disabled = true;
    //         quizStepButtons.forEach(btn => {
    //             btn.style.visibility = 'hidden';
    //         });
    //         return;
    //     }
        
    //     // Show step buttons once quiz has started
    //     quizStepButtons.forEach(btn => {
    //         btn.style.visibility = 'visible';
    //     });
        
    //     prevBtn.disabled = currentState.quizStep === 1;
    //     nextBtn.disabled = (currentState.quizStep === 1 && !currentState.department) ||
    //                       (currentState.quizStep === 2 && !currentState.surgeryType) ||
    //                       (currentState.quizStep === 3);
    // }

    // Function to show the start page
    function showStartPage() {
        // Clear the questionnaire container
        questionnaireContainer.innerHTML = '';
        
        const startContainer = document.createElement('div');
        startContainer.classList.add('start-container');
        
        const heading = document.createElement('h2');
        heading.textContent = 'Surgical Pathways Quiz';
        startContainer.appendChild(heading);
        
        const description = document.createElement('p');
        description.textContent = 'If you were about to undergo surgery, wouldn’t you want to know which department offers the best chances of recovery?';
        startContainer.appendChild(description);
        
        const startButton = document.createElement('button');
        startButton.classList.add('start-button');
        startButton.textContent = 'Start Quiz';
        startButton.addEventListener('click', startQuiz);
        startContainer.appendChild(startButton);
        
        questionnaireContainer.appendChild(startContainer);
    }
    
    // Function to start the quiz
    function startQuiz() {
        currentState.started = true;
        currentState.quizStep = 1;
        updateStepIndicator(1);
        showDepartmentSelection();
        // updateQuizButtonStates();
    }
    
    // Content display functions
    function showDepartmentSelection() {
        // Clear the questionnaire container
        questionnaireContainer.innerHTML = '';
        
        const departmentContainer = document.createElement('div');
        departmentContainer.classList.add('questionnaire-container');
        
        const heading = document.createElement('h2');
        heading.textContent = 'Question 1: Which surgical department do you trust the most?';
        departmentContainer.appendChild(heading);

        const departmentOptions = document.createElement('div');
        departmentOptions.classList.add('option-container');
        
        surgicalData.departments.forEach(dept => {
            const option = createOptionCard(dept.name, dept.description, dept.id);
            option.addEventListener('click', () => {
                // Highlight selected option
                document.querySelectorAll('.option-card').forEach(card => {
                    card.classList.remove('selected');
                });
                option.classList.add('selected');
                
                // Select department and advance to next step
                selectDepartment(dept.id);
            });
            
            // If this department is currently selected, highlight it
            if (currentState.department === dept.id) {
                option.classList.add('selected');
            }
            
            departmentOptions.appendChild(option);
        });
        
        departmentContainer.appendChild(departmentOptions);
        questionnaireContainer.appendChild(departmentContainer);
        
        // updateQuizButtonStates();
    }

    function showSurgeryTypeSelection() {
        // Clear the questionnaire container
        questionnaireContainer.innerHTML = '';
        
        const surgeryContainer = document.createElement('div');
        surgeryContainer.classList.add('questionnaire-container');
        
        const heading = document.createElement('h2');
        heading.textContent = 'Question 2: What kind of surgery would you like to have?';
        surgeryContainer.appendChild(heading);
        
        const surgeryOptions = document.createElement('div');
        surgeryOptions.classList.add('option-container');
        
        surgicalData.surgeryTypes.forEach(type => {
            const option = createOptionCard(type.name, type.description, type.id);
            option.addEventListener('click', () => {
                // Highlight selected option
                document.querySelectorAll('.option-card').forEach(card => {
                    card.classList.remove('selected');
                });
                option.classList.add('selected');
                
                // Select surgery type and advance to next step
                selectSurgeryType(type.id);
            });
            
            // If this surgery type is currently selected, highlight it
            if (currentState.surgeryType === type.id) {
                option.classList.add('selected');
            }
            
            surgeryOptions.appendChild(option);
        });
        
        surgeryContainer.appendChild(surgeryOptions);
        questionnaireContainer.appendChild(surgeryContainer);
        
        // updateQuizButtonStates();
    }

    async function showResults() {
        // Clear the questionnaire container
        questionnaireContainer.innerHTML = '';
        
        const resultsContainer = document.createElement('div');
        resultsContainer.classList.add('results-container');
        
        const heading = document.createElement('h2');
        heading.textContent = 'Your Surgery Pathway Results';
        resultsContainer.appendChild(heading);

        // Get the department and surgery type names
        const department = surgicalData.departments.find(d => d.id === currentState.department);
        const surgeryType = surgicalData.surgeryTypes.find(t => t.id === currentState.surgeryType);
        
        // Get outcome data with proper error handling
        let outcomes;
        try {
            // Clear cache if this is a new session or if explicitly requested
            if (sessionStorage.getItem('clearCache') === 'true') {
                surgicalData.clearCache();
                sessionStorage.removeItem('clearCache');
            }
            
            // Show loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.classList.add('loading-indicator');
            loadingIndicator.innerHTML = '<p>Loading outcome data...</p>';
            resultsContainer.appendChild(loadingIndicator);
            
            // Fetch outcomes data
            console.log(`Fetching outcomes data for ${currentState.surgeryType} surgery type...`);
            const allOutcomes = await surgicalData.calculateOutcomes();
            
            // Remove loading indicator
            resultsContainer.removeChild(loadingIndicator);
            
            outcomes = allOutcomes[currentState.surgeryType];
            
            if (!outcomes) {
                throw new Error(`No outcome data available for ${currentState.surgeryType} surgery type`);
            }
            
            console.log(`Retrieved outcomes for ${currentState.surgeryType}:`, outcomes);
        } catch (error) {
            console.error('Error getting outcome data:', error);
            
            // Show error message to user
            const errorMessage = document.createElement('div');
            errorMessage.classList.add('error-message');
            errorMessage.innerHTML = `
                <p>We encountered an issue retrieving data from the CSV file.</p>
                <p>No data is available for this selection. <button id="retryDataBtn">Retry</button></p>
            `;
            resultsContainer.appendChild(errorMessage);
            
            // Add retry button functionality
            setTimeout(() => {
                const retryBtn = document.getElementById('retryDataBtn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        sessionStorage.setItem('clearCache', 'true');
                        showResults();
                    });
                }
            }, 0);
            
            // Create fallback data if outcomes couldn't be retrieved
            outcomes = {
                death: "N/A",
                recovery: {
                    within3days: "N/A",
                    within3to7days: "N/A",
                    over7days: "N/A"
                }
            };
        }
        
        // Create summary section
        const summary = document.createElement('div');
        summary.classList.add('summary-section');
        
        const summaryHeading = document.createElement('h3');
        summaryHeading.textContent = `${department.name} Department with ${surgeryType.name} Surgery`;
        summary.appendChild(summaryHeading);
        
        // Create statistics section
        const statistics = document.createElement('div');
        statistics.classList.add('statistics-section');
        
        // Add outcome statistics
        const outcomesList = document.createElement('ul');
        outcomesList.classList.add('outcomes-list');
        
        // Format values for display, handling potential non-numeric values
        const formatValue = (value) => {
            if (value === "N/A") return value;
            return isNaN(parseFloat(value)) ? "0.0%" : `${value}%`;
        };
        
        outcomesList.innerHTML = `
            <li class="stat-item"><span class="stat-value">${formatValue(outcomes.death)}</span> chance of death</li>
            <li class="stat-item"><span class="stat-value">${formatValue(outcomes.recovery.within3days)}</span> chance of recovering within 3 days</li>
            <li class="stat-item"><span class="stat-value">${formatValue(outcomes.recovery.within3to7days)}</span> chance of recovering within 3-7 days</li>
            <li class="stat-item"><span class="stat-value">${formatValue(outcomes.recovery.over7days)}</span> chance of recovering within 7+ days</li>
        `;
        
        statistics.appendChild(outcomesList);
        
        // Add story container with personalized content
        const storyContainer = document.createElement('div');
        storyContainer.classList.add('story-container');
        
        // Calculate combined recovery rate within a week, handling potential non-numeric values
        let withinWeekRecovery = "N/A";
        if (outcomes.recovery.within3days !== "N/A" && outcomes.recovery.within3to7days !== "N/A") {
            const within3 = parseFloat(outcomes.recovery.within3days) || 0;
            const within3to7 = parseFloat(outcomes.recovery.within3to7days) || 0;
            withinWeekRecovery = (within3 + within3to7).toFixed(1);
        }
        
        // Check if we have any real data
        const hasRealData = outcomes.death !== "N/A" ||
                           outcomes.recovery.within3days !== "N/A" ||
                           outcomes.recovery.within3to7days !== "N/A" ||
                           outcomes.recovery.over7days !== "N/A";
        
        if (hasRealData) {
            storyContainer.innerHTML = `
                <p>Based on your selections and <strong>real data from the CSV file</strong>, here's what you might expect:</p>
                <p>You'll undergo ${surgeryType.name.toLowerCase()} surgery in the ${department.name.toLowerCase()} department.</p>
                ${outcomes.recovery.within3days !== "N/A" ?
                    `<p>The good news is that you have a <strong>${formatValue(outcomes.recovery.within3days)}</strong> chance of recovering within just 3 days.</p>` :
                    `<p>Recovery time data within 3 days is not available in the CSV file.</p>`
                }
                ${withinWeekRecovery !== "N/A" ?
                    `<p>Most patients (about <strong>${withinWeekRecovery}%</strong>) are able to recover within a week.</p>` :
                    ``
                }
                ${outcomes.death !== "N/A" ?
                    `<p>The mortality risk is ${parseFloat(outcomes.death) < 1 ? "very low" : "relatively low"} at <strong>${formatValue(outcomes.death)}</strong>.</p>` :
                    `<p>Mortality risk data is not available in the CSV file.</p>`
                }
                <p>Remember that these are statistical averages based on real patient data and your individual experience may vary based on your specific condition,
                overall health, and how well you follow post-operative care instructions.</p>
            `;
        } else {
            storyContainer.innerHTML = `
                <p>We couldn't retrieve any data from the CSV file for your selection.</p>
                <p>You selected ${surgeryType.name.toLowerCase()} surgery in the ${department.name.toLowerCase()} department.</p>
                <p>Please try a different selection or check if the CSV file contains the appropriate data.</p>
                <p>All statistics shown are based solely on data from the CSV file with no synthetic or hardcoded values.</p>
            `;
        }
        
        // Create retry button
        const retryButton = document.createElement('button');
        retryButton.classList.add('retry-button');
        retryButton.textContent = 'Retry Quiz';
        retryButton.addEventListener('click', resetQuestionnaire);
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('button-container');
        buttonContainer.appendChild(retryButton);
        
        resultsContainer.appendChild(summary);
        resultsContainer.appendChild(storyContainer);
        resultsContainer.appendChild(statistics);
        resultsContainer.appendChild(buttonContainer);
        
        questionnaireContainer.appendChild(resultsContainer);
        
        // Trigger an event to notify global.js to update the Sankey diagram
        const event = new CustomEvent('questionnaireComplete', {
            detail: {
                department: department.id,
                surgeryType: surgeryType.id,
                outcomes: outcomes
            }
        });
        document.dispatchEvent(event);
    }

    // Helper for creating option cards
    function createOptionCard(title, description, id) {
        const card = document.createElement('div');
        card.classList.add('option-card');
        card.dataset.id = id;
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        
        const descElement = document.createElement('p');
        descElement.textContent = description;
        
        card.appendChild(titleElement);
        card.appendChild(descElement);
        
        return card;
    }

    // Actions for selection
    function selectDepartment(departmentId) {
        currentState.department = departmentId;
        // updateQuizButtonStates();
        
        // Automatically move to question 2 after selecting a department
        setTimeout(() => {
            goToStep(2);
        }, 300); // Small delay for better user experience
    }

    function selectSurgeryType(typeId) {
        currentState.surgeryType = typeId;
        // updateQuizButtonStates();
        
        // Automatically move to results after selecting a surgery type
        setTimeout(() => {
            goToStep(3);
        }, 300); // Small delay for better user experience
    }

    // Generate data for the Sankey diagram visualization
    async function generateSankeyData() {
        if (!currentState.department || !currentState.surgeryType) {
            return null;
        }
        
        try {
            // Fetch the latest outcomes data
            const outcomes = await surgicalData.calculateOutcomes();
            
            if (!outcomes || !outcomes[currentState.surgeryType]) {
                console.warn(`No outcome data available for ${currentState.surgeryType} surgery type`);
                return {
                    department: currentState.department,
                    surgeryType: currentState.surgeryType,
                    outcomes: null,
                    dataSource: "No data available from CSV"
                };
            }
            
            return {
                department: currentState.department,
                surgeryType: currentState.surgeryType,
                outcomes: outcomes[currentState.surgeryType],
                dataSource: "CSV data"
            };
        } catch (error) {
            console.error("Error generating Sankey data:", error);
            return {
                department: currentState.department,
                surgeryType: currentState.surgeryType,
                outcomes: null,
                dataSource: "Error retrieving data from CSV"
            };
        }
    }

    // Add dynamic CSS for questionnaire UI
    addQuestionnaireStyling();
});

// Add dynamic CSS for questionnaire UI
function addQuestionnaireStyling() {
    if (document.getElementById('questionnaire-styles')) return;
    
    const styleSheet = document.createElement("style");
    styleSheet.id = 'questionnaire-styles';
    styleSheet.textContent = `
        .questionnaire-section {
            max-width: auto;
            margin: 0 auto 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 20px;
        }
        
        .questionnaire-container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            transition: opacity 0.4s ease, transform 0.4s ease;
        }
        
        .option-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-top: 20px;
        }
        
        .option-card {
            flex: 1 1 calc(50% - 20px);
            min-width: 250px;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .option-card:hover {
            border-color: #4CAF50;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
        }
        
        .option-card.selected {
            border-color: #4CAF50;
            background-color: rgba(76, 175, 80, 0.1);
        }
        
        .option-card h3 {
            margin-top: 0;
            color: #333;
        }
        
        .option-card p {
            color: #666;
            margin-bottom: 0;
        }
        
        .results-container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            transition: opacity 0.4s ease, transform 0.4s ease;
        }
        
        .summary-section {
            margin-bottom: 30px;
        }
        
        .statistics-section {
            margin-top: 30px;
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
        }
        
        .outcomes-list {
            display: flex;
            flex-wrap: wrap;
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .stat-item {
            flex: 1 1 calc(50% - 20px);
            margin: 10px;
            padding: 15px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
        }
        
        .step.active {
            background-color: #4CAF50;
            color: white;
        }
        
        .start-container {
            text-align: center;
            padding: 40px 20px;
            max-width: auto;
            margin: 0 auto;
            transition: opacity 0.4s ease, transform 0.4s ease;
        }
        
        .start-container h2 {
            font-size: 28px;
            margin-bottom: 20px;
            color: #333;
            text-align: center;
        }
        
        .start-container p {
            font-size: 20px;
            margin-bottom: 30px;
            color: #666;
            text-align: center;
        }
        
        .start-button {
            font-size: 18px;
            padding: 15px 40px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .start-button:hover {
            background-color: #3e8e41;
        }
        
        .button-container {
            display: flex;
            justify-content: center;
            margin-top: 30px;
        }
        
        .retry-button {
            font-size: 16px;
            padding: 12px 30px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .retry-button:hover {
            background-color: #3e8e41;
        }
        
        .loading-indicator {
            text-align: center;
            padding: 20px;
            margin: 20px 0;
            background-color: #f8f9fa;
            border-radius: 8px;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
        }
        
        .error-message {
            padding: 15px;
            margin: 15px 0;
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 8px;
            color: #856404;
        }
        
        .error-message button {
            background-color: #856404;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 10px;
        }
        
        .error-message button:hover {
            background-color: #6a5003;
        }
    `;
    document.head.appendChild(styleSheet);
}
