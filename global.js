// Global data variable
let sankeyData = null;

// Function to load and process the data
async function loadData() {
    try {
        // Show loading indicator
        d3.select("#chart").html("<div class='loading'>Loading data...</div>");
        
        // Fetch the data file
        const response = await fetch('cases.txt');
        const text = await response.text();
        
        // Parse the CSV/TSV data
        Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                processData(results.data);
            },
            error: function(error) {
                console.error("Error parsing data:", error);
            }
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        d3.select("#chart").html("<div class='loading'>Error loading data. Please check console for details.</div>");
    }
}

// Process the data to create Sankey diagram data structure
function processData(rawData) {
    // Extract unique departments, approaches, and create outcome categories
    const departments = [...new Set(rawData.map(d => d.department))];
    const approaches = [...new Set(rawData.map(d => d.approach))];
    
    // Define nodes for Sankey diagram
    const nodes = [
        // Department nodes
        ...departments.map(dept => ({
            id: dept,
            name: dept,
            type: "department"
        })),
        
        // Approach nodes
        ...approaches.map(app => ({
            id: app,
            name: app,
            type: "approach"
        })),
        
        // Outcome nodes (pre-defined)
        { id: "Survived - Short Stay", name: "Survived (< 3 days)", type: "outcome" },
        { id: "Survived - Medium Stay", name: "Survived (3-7 days)", type: "outcome" },
        { id: "Survived - Long Stay", name: "Survived (> 7 days)", type: "outcome" },
        { id: "Died", name: "Died", type: "outcome" }
    ];
    
    // Create department to approach links
    const deptToApproachLinks = [];
    departments.forEach(dept => {
        approaches.forEach(app => {
            // Count cases for this department-approach combination
            const count = rawData.filter(d => d.department === dept && d.approach === app).length;
            
            if (count > 0) {
                deptToApproachLinks.push({
                    source: dept,
                    target: app,
                    value: count
                });
            }
        });
    });
    
    // Create approach to outcome links
    const approachToOutcomeLinks = [];
    approaches.forEach(app => {
        // Filter cases for this approach
        const appCases = rawData.filter(d => d.approach === app);
        
        // Count by outcome
        const shortStay = appCases.filter(d => d.death_inhosp === 0 && d.los_postop < 3).length;
        const mediumStay = appCases.filter(d => d.death_inhosp === 0 && d.los_postop >= 3 && d.los_postop <= 7).length;
        const longStay = appCases.filter(d => d.death_inhosp === 0 && d.los_postop > 7).length;
        const died = appCases.filter(d => d.death_inhosp === 1).length;
        
        // Add links if there are cases
        if (shortStay > 0) {
            approachToOutcomeLinks.push({
                source: app,
                target: "Survived - Short Stay",
                value: shortStay
            });
        }
        
        if (mediumStay > 0) {
            approachToOutcomeLinks.push({
                source: app,
                target: "Survived - Medium Stay",
                value: mediumStay
            });
        }
        
        if (longStay > 0) {
            approachToOutcomeLinks.push({
                source: app,
                target: "Survived - Long Stay",
                value: longStay
            });
        }
        
        if (died > 0) {
            approachToOutcomeLinks.push({
                source: app,
                target: "Died",
                value: died
            });
        }
    });
    
    // Combine all links
    const links = [...deptToApproachLinks, ...approachToOutcomeLinks];
    
    // If no real data is found, use sample data
    if (links.length === 0) {
        console.warn("No valid data found in file, using sample data instead");
        useSampleData();
    } else {
        // Store data and create the visualization
        sankeyData = {
            nodes: nodes,
            links: links
        };
        createSankeyDiagram();
    }
}

// Function to use sample data if real data can't be loaded
function useSampleData() {
    // Sample data structure with synthetic data
    sankeyData = {
        nodes: [
            // Departments (Layer 1)
            {id: "General surgery", name: "General Surgery", type: "department"},
            {id: "Gynecology", name: "Gynecology", type: "department"},
            {id: "Thoracic", name: "Thoracic", type: "department"},
            {id: "Orthopedic", name: "Orthopedic", type: "department"},
            {id: "Neurosurgery", name: "Neurosurgery", type: "department"},
            
            // Approaches (Layer 2)
            {id: "Open", name: "Open Surgery", type: "approach"},
            {id: "Laparoscopic", name: "Laparoscopic", type: "approach"},
            {id: "Robotic", name: "Robotic Surgery", type: "approach"},
            {id: "Endoscopic", name: "Endoscopic", type: "approach"},
            {id: "Videoscopic", name: "Videoscopic", type: "approach"},
            
            // Outcomes (Layer 3)
            {id: "Survived - Short Stay", name: "Survived (< 3 days)", type: "outcome"},
            {id: "Survived - Medium Stay", name: "Survived (3-7 days)", type: "outcome"},
            {id: "Survived - Long Stay", name: "Survived (> 7 days)", type: "outcome"},
            {id: "Died", name: "Died", type: "outcome"}
        ],
        links: [
            // Department to Approach links
            {source: "General surgery", target: "Open", value: 1200},
            {source: "General surgery", target: "Laparoscopic", value: 900},
            {source: "General surgery", target: "Robotic", value: 200},
            {source: "Gynecology", target: "Open", value: 300},
            {source: "Gynecology", target: "Laparoscopic", value: 450},
            {source: "Gynecology", target: "Robotic", value: 250},
            {source: "Thoracic", target: "Open", value: 500},
            {source: "Thoracic", target: "Videoscopic", value: 350},
            {source: "Thoracic", target: "Robotic", value: 150},
            {source: "Orthopedic", target: "Open", value: 700},
            {source: "Orthopedic", target: "Endoscopic", value: 300},
            {source: "Neurosurgery", target: "Open", value: 550},
            {source: "Neurosurgery", target: "Endoscopic", value: 150},
            
            // Approach to Outcome links
            {source: "Open", target: "Survived - Short Stay", value: 900},
            {source: "Open", target: "Survived - Medium Stay", value: 1600},
            {source: "Open", target: "Survived - Long Stay", value: 650},
            {source: "Open", target: "Died", value: 100},
            {source: "Laparoscopic", target: "Survived - Short Stay", value: 850},
            {source: "Laparoscopic", target: "Survived - Medium Stay", value: 450},
            {source: "Laparoscopic", target: "Survived - Long Stay", value: 40},
            {source: "Laparoscopic", target: "Died", value: 10},
            {source: "Robotic", target: "Survived - Short Stay", value: 350},
            {source: "Robotic", target: "Survived - Medium Stay", value: 230},
            {source: "Robotic", target: "Survived - Long Stay", value: 15},
            {source: "Robotic", target: "Died", value: 5},
            {source: "Endoscopic", target: "Survived - Short Stay", value: 320},
            {source: "Endoscopic", target: "Survived - Medium Stay", value: 110},
            {source: "Endoscopic", target: "Survived - Long Stay", value: 15},
            {source: "Endoscopic", target: "Died", value: 5},
            {source: "Videoscopic", target: "Survived - Short Stay", value: 240},
            {source: "Videoscopic", target: "Survived - Medium Stay", value: 95},
            {source: "Videoscopic", target: "Survived - Long Stay", value: 10},
            {source: "Videoscopic", target: "Died", value: 5}
        ]
    };
    
    createSankeyDiagram();
}

// Define the main visualization function
function createSankeyDiagram() {
    // Clear any existing chart
    d3.select("#chart").html("");
    
    // Set up dimensions
    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = document.getElementById("chart").clientWidth - margin.left - margin.right;
    const height = document.getElementById("chart").clientHeight - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = d3.select("#chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Create tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    // Define color scales for each node type
    const departmentColor = d3.scaleOrdinal()
        .domain(sankeyData.nodes.filter(n => n.type === "department").map(n => n.id))
        .range(d3.schemeCategory10);
    
    const approachColor = d3.scaleOrdinal()
        .domain(sankeyData.nodes.filter(n => n.type === "approach").map(n => n.id))
        .range(d3.schemeSet3);
    
    const outcomeColor = d3.scaleOrdinal()
        .domain(["Survived - Short Stay", "Survived - Medium Stay", "Survived - Long Stay", "Died"])
        .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"]);
    
    // Create a copy of the data for animation and filtering
    let data = JSON.parse(JSON.stringify(sankeyData));
    
    // Setup Sankey generator
    const sankey = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(20)
        .nodePadding(10)
        .extent([[0, 0], [width, height]]);
    
    // Initialize with empty data for animation
    let graph = {
        nodes: data.nodes,
        links: []
    };
    
    // Process the data with Sankey layout
    const sankeyLayout = sankey(graph);
    
    // Initialize animation step
    let currentStep = 0;
    
    // Function to determine node color based on its type
    function getNodeColor(d) {
        if (d.type === "department") return departmentColor(d.id);
        if (d.type === "approach") return approachColor(d.id);
        if (d.type === "outcome") return outcomeColor(d.id);
        return "#ccc"; // Default color
    }
    
    // Draw the initial links (empty for animation)
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("path")
        .data(sankeyLayout.links)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => d3.color(getNodeColor(d.source)).darker(0.5))
        .attr("stroke-width", d => Math.max(1, d.width));
    
    // Draw the nodes
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(sankeyLayout.nodes)
        .enter().append("g");
    
    // Add rectangles for the nodes
    node.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => getNodeColor(d))
        .attr("stroke", d => d3.color(getNodeColor(d)).darker(0.5));
    
    // Add labels for the nodes
    node.append("text")
        .attr("x", d => d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d.name)
        .filter(d => d.x0 < width / 2)
        .attr("x", d => d.x1 + 6)
        .attr("text-anchor", "start");
    
    // Function to update the diagram with new data
    function updateDiagram(newLinks, transitionDuration = 750) {
        // Update the graph with new links
        graph = {
            nodes: data.nodes,
            links: newLinks
        };
        
        // Recompute the Sankey layout
        const newSankeyData = sankey(graph);
        
        // Update links with transition
        const linkUpdate = svg.select(".links")
            .selectAll("path")
            .data(newSankeyData.links, d => `${d.source.id}-${d.target.id}`);
        
        // Remove old links
        linkUpdate.exit().remove();
        
        // Add new links
        const newLinkElements = linkUpdate.enter()
            .append("path")
            .attr("class", "link")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => d3.color(getNodeColor(d.source)).darker(0.5))
            .attr("stroke-width", 0); // Start with 0 width for animation
        
        // Update all links with transition
        linkUpdate.merge(newLinkElements)
            .transition()
            .duration(transitionDuration)
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke-width", d => Math.max(1, d.width));
        
        // Update nodes with transition
        const nodeUpdate = svg.select(".nodes")
            .selectAll("g")
            .data(newSankeyData.nodes, d => d.id);
        
        nodeUpdate.select("rect")
            .transition()
            .duration(transitionDuration)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0);
        
        nodeUpdate.select("text")
            .transition()
            .duration(transitionDuration)
            .attr("y", d => (d.y1 + d.y0) / 2);
        
        // Add tooltips and interactivity
        svg.selectAll(".link")
            .on("mouseover", function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                const percentage = ((d.value / d.source.value) * 100).toFixed(1);
                tooltip.html(`<strong>${d.source.name} → ${d.target.name}</strong><br>
                            Patients: ${d.value}<br>
                            ${percentage}% of ${d.source.name} patients`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        
        // Add click interactivity to nodes
        svg.selectAll("rect")
            .on("click", function(event, d) {
                // Filter links to show only those connected to the clicked node
                const nodeLinks = data.links.filter(link => 
                    link.source === d.id || link.target === d.id ||
                    (typeof link.source === 'object' && link.source.id === d.id) ||
                    (typeof link.target === 'object' && link.target.id === d.id)
                );
                
                // Get connected node IDs to highlight
                const connectedNodes = new Set();
                nodeLinks.forEach(link => {
                    connectedNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
                    connectedNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
                });
                
                // Update node styles
                svg.selectAll("rect")
                    .style("opacity", node => connectedNodes.has(node.id) ? 1 : 0.3);
                
                // Update the diagram with filtered links
                updateDiagram(nodeLinks);
                
                d3.select("#resetBtn").property("disabled", false);
            })
            .on("mouseover", function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                let incomingValue = 0;
                let outgoingValue = 0;
                
                newSankeyData.links.forEach(link => {
                    if ((typeof link.target === 'object' && link.target.id === d.id) ||
                        link.target === d.id) {
                        incomingValue += link.value;
                    }
                    if ((typeof link.source === 'object' && link.source.id === d.id) ||
                        link.source === d.id) {
                        outgoingValue += link.value;
                    }
                });
                
                let tooltipContent = `<strong>${d.name}</strong><br>Total patients: `;
                
                if (d.type === "department") {
                    tooltipContent += `${outgoingValue}<br>Click to focus on this department's pathways`;
                } else if (d.type === "approach") {
                    tooltipContent += `${incomingValue}<br>Click to focus on this approach's outcomes`;
                } else {
                    const totalPatients = data.links.reduce((sum, link) => sum + link.value, 0) / 2;
                    tooltipContent += `${incomingValue}<br>${((incomingValue / totalPatients) * 100).toFixed(1)}% of all patients`;
                }
                
                tooltip.html(tooltipContent)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    }
    
    // Animation functions
    function animateStep() {
        updateStepIndicator(currentStep);
        
        if (currentStep === 0) {
            // Show only department nodes
            const departmentLinks = [];
            updateDiagram(departmentLinks);
            d3.select("#prevBtn").property("disabled", true);
            d3.select("#nextBtn").property("disabled", false);
        } else if (currentStep === 1) {
            // Show department to approach links
            const departmentToApproachLinks = data.links.filter(link => {
                const sourceIsObject = typeof link.source === 'object';
                const sourceId = sourceIsObject ? link.source.id : link.source;
                const sourceNode = data.nodes.find(n => n.id === sourceId);
                return sourceNode && sourceNode.type === "department";
            });
            updateDiagram(departmentToApproachLinks);
            d3.select("#prevBtn").property("disabled", false);
            d3.select("#nextBtn").property("disabled", false);
        } else if (currentStep === 2) {
            // Show all links
            updateDiagram(data.links);
            d3.select("#prevBtn").property("disabled", false);
            d3.select("#nextBtn").property("disabled", true);
        }
    }
    
    function updateStepIndicator(step) {
        d3.selectAll(".step").classed("active", (d, i) => i === step);
    }
    
    // Initialize animation controls
    d3.select("#resetBtn").on("click", function() {
        // Reset filtered nodes opacity
        svg.selectAll("rect").style("opacity", 1);
        // Reset to full data
        updateDiagram(data.links);
        d3.select(this).property("disabled", true);
    });
    
    d3.select("#animateBtn").on("click", function() {
        // Start animation from beginning
        currentStep = 0;
        animateStep();
        
        // Animate through all steps
        const interval = setInterval(() => {
            currentStep++;
            if (currentStep > 2) {
                clearInterval(interval);
                return;
            }
            animateStep();
        }, 2000);
    });
    
    d3.select("#prevBtn").on("click", function() {
        if (currentStep > 0) {
            currentStep--;
            animateStep();
        }
    });
    
    d3.select("#nextBtn").on("click", function() {
        if (currentStep < 2) {
            currentStep++;
            animateStep();
        }
    });
    
    // Start with initial step
    animateStep();
    
    // Create legend
    const legend = d3.select(".container").append("div")
        .attr("class", "legend");
    
    // Department legend
    const departmentLegend = legend.append("div").attr("class", "legend-section");
    departmentLegend.append("h4").text("Departments");
    
    const departmentItems = departmentLegend.selectAll(".legend-item")
        .data(departmentColor.domain())
        .enter().append("div")
        .attr("class", "legend-item");
    
    departmentItems.append("div")
        .attr("class", "legend-color")
        .style("background-color", d => departmentColor(d));
    
    departmentItems.append("div")
        .text(d => d);
    
    // Approach legend
    const approachLegend = legend.append("div").attr("class", "legend-section");
    approachLegend.append("h4").text("Approaches");
    
    const approachItems = approachLegend.selectAll(".legend-item")
        .data(approachColor.domain())
        .enter().append("div")
        .attr("class", "legend-item");
    
    approachItems.append("div")
        .attr("class", "legend-color")
        .style("background-color", d => approachColor(d));
    
    approachItems.append("div")
        .text(d => d);
    
    // Outcome legend
    const outcomeLegend = legend.append("div").attr("class", "legend-section");
    outcomeLegend.append("h4").text("Outcomes");
    
    const outcomeItems = outcomeLegend.selectAll(".legend-item")
        .data(outcomeColor.domain())
        .enter().append("div")
        .attr("class", "legend-item");
    
    outcomeItems.append("div")
        .attr("class", "legend-color")
        .style("background-color", d => outcomeColor(d));
    
    outcomeItems.append("div")
        .text(d => d);
}

// Initial page load
document.addEventListener('DOMContentLoaded', function() {
    // Load data from file
    loadData();
    
    // Make it responsive
    window.addEventListener('resize', function() {
        if (sankeyData) {
            createSankeyDiagram();
        }
    });
});