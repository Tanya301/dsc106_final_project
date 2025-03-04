// - - - Navigation - - - //
const ARE_WE_HOME = document.documentElement.classList.contains('home');

let pages = [
    { url: '', title: 'Home' },
    { url: 'writeup.html', title: 'Writeup' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

// Get the directory path from the current URL
const currentPath = location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);

for (let p of pages) {
    let url = p.url;
    let title = p.title;
    
    // Construct the correct URL by combining current directory path with the page URL
    url = currentPath + url;
    
    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;
    
    if (a.host !== location.host) {
        a.target = '_blank';
    }
    
    // Check if this is the current page
    if (a.host === location.host && location.pathname === a.pathname) {
        a.classList.add('current');
    }
    
    nav.append(a);
}

// - - - Visualization - - - //
// Global data variable
let sankeyData = null;

// Function to load and process the data
async function loadData() {
    try {
        // Show loading indicator
        d3.select("#chart").html("<div class='loading'>Loading data...</div>");
        
        try {
            // Try to fetch the data file
            const response = await fetch('cases.csv');
            const text = await response.text();
            
            // Parse the CSV data
            Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    console.log("CSV loaded successfully");
                    
                    // Check if we have data rows
                    if (results.data && results.data.length > 0) {
                        try {
                            // Use the real data to build the structure
                            createRealDataStructure(results.data);
                        } catch (error) {
                            console.error("Error processing CSV data:", error);
                        }
                    } else {
                        console.error("No data rows found in CSV");
                    }
                },
                error: function(error) {
                    console.error("Error parsing CSV:", error);
                }
            });
        } catch (error) {
            console.error("Error fetching CSV file:", error);
        }
    } catch (error) {
        console.error("Unexpected error:", error);
    }
}

// Create a proper data structure from real data
function createRealDataStructure(rawData) {
    console.log("Processing data...");
    
    // Filter out rows missing key values - ensure we have department, approach, and death_inhosp
    const validRows = rawData.filter(row => 
        row &&
        row.department &&
        row.approach &&
        typeof row.death_inhosp !== 'undefined'
    );
    
    if (validRows.length === 0) {
        console.error("No valid data rows found with required fields");
        return;
    }
    
    console.log(`Found ${validRows.length} valid rows out of ${rawData.length} total`);
    
    // Extract unique departments and approaches
    const departments = [...new Set(validRows.map(row => row.department))];
    const approaches = [...new Set(validRows.map(row => row.approach))];
    
    console.log("Found departments:", departments);
    console.log("Found approaches:", approaches);
    
    // Build node structure - ensure proper node types
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
    
    // Create department-to-approach links
    const deptToApproachLinks = [];
    departments.forEach(dept => {
        approaches.forEach(app => {
            const count = validRows.filter(row => row.department === dept && row.approach === app).length;
            if (count > 0) {
                deptToApproachLinks.push({
                    source: dept,
                    target: app,
                    value: count
                });
            }
        });
    });
    
    // Create approach-to-outcome links
    const approachToOutcomeLinks = [];
    approaches.forEach(app => {
        const appCases = validRows.filter(row => row.approach === app);
        const hasLOS = appCases.some(row => typeof row.los_postop !== 'undefined');
        
        let shortStay = 0, mediumStay = 0, longStay = 0, died = 0;
        
        if (hasLOS) {
            shortStay = appCases.filter(row => row.death_inhosp === 0 && row.los_postop < 3).length;
            mediumStay = appCases.filter(row => row.death_inhosp === 0 && row.los_postop >= 3 && row.los_postop <= 7).length;
            longStay = appCases.filter(row => row.death_inhosp === 0 && row.los_postop > 7).length;
        } else {
            const survivors = appCases.filter(row => row.death_inhosp === 0).length;
            shortStay = Math.round(survivors * 0.4);
            mediumStay = Math.round(survivors * 0.4);
            longStay = survivors - shortStay - mediumStay;
        }
        
        died = appCases.filter(row => row.death_inhosp === 1).length;
        
        if (shortStay > 0) {
            approachToOutcomeLinks.push({ source: app, target: "Survived - Short Stay", value: shortStay });
        }
        if (mediumStay > 0) {
            approachToOutcomeLinks.push({ source: app, target: "Survived - Medium Stay", value: mediumStay });
        }
        if (longStay > 0) {
            approachToOutcomeLinks.push({ source: app, target: "Survived - Long Stay", value: longStay });
        }
        if (died > 0) {
            approachToOutcomeLinks.push({ source: app, target: "Died", value: died });
        }
    });
    
    const links = [...deptToApproachLinks, ...approachToOutcomeLinks];
    console.log(`Created ${links.length} links`);
    
    // Sort nodes by type to ensure proper display order
    nodes.sort((a, b) => {
        const typeOrder = { "department": 0, "approach": 1, "outcome": 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
            return typeOrder[a.type] - typeOrder[b.type];
        }
        return a.name.localeCompare(b.name);
    });
    
    sankeyData = { nodes: nodes, links: links };
    createSankeyDiagram();
}

// Main visualization function
function createSankeyDiagram() {
    try {
        // Helper function to validate node coordinates
        function validateNodeCoordinates(nodes) {
            return nodes.map(node => {
                if (!node) return node;
                // Ensure all coordinates are valid numbers
                if (node.x0 === undefined || isNaN(node.x0)) node.x0 = 0;
                if (node.x1 === undefined || isNaN(node.x1)) node.x1 = node.x0 + 20;
                if (node.y0 === undefined || isNaN(node.y0)) node.y0 = 0;
                if (node.y1 === undefined || isNaN(node.y1)) node.y1 = node.y0 + 10;
                
                // Ensure minimum dimensions
                if (node.x1 - node.x0 < 1) node.x1 = node.x0 + 1;
                if (node.y1 - node.y0 < 1) node.y1 = node.y0 + 1;

                // Ensure node has a type
                node.type = node.type || "unknown";
                
                return node;
            });
        }
        
        // Clear any existing chart and tooltips
        d3.select("#chart").html("");
        d3.selectAll(".tooltip").remove();
        
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
        
        // Define color scales for nodes
        const departmentColor = d3.scaleOrdinal()
            .domain(sankeyData.nodes.filter(n => n.type === "department").map(n => n.id))
            .range(d3.schemeCategory10);
        
        const approachColor = d3.scaleOrdinal()
            .domain(sankeyData.nodes.filter(n => n.type === "approach").map(n => n.id))
            .range(d3.schemeSet3);
        
        const outcomeColor = d3.scaleOrdinal()
            .domain(["Survived - Short Stay", "Survived - Medium Stay", "Survived - Long Stay", "Died"])
            .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"]);
        
        // Deep copy of data for internal use
        let data = {
            nodes: sankeyData.nodes.map(node => ({ ...node })),
            links: sankeyData.links.map(link => ({ ...link, source: link.source, target: link.target }))
        };
        // Ensure links reference node IDs
        data.links = data.links.map(link => ({
            source: typeof link.source === 'object' ? link.source.id : link.source,
            target: typeof link.target === 'object' ? link.target.id : link.target,
            value: link.value
        }));
        
        // Setup the Sankey generator
        const sankey = d3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(20)
            .nodePadding(40) // Increased padding for better spacing
            .extent([[0, 0], [width, height]]);
        
        // Initialize with no links (for positioning)
        let graph = { nodes: [...data.nodes], links: [] };
        const sankeyData1 = sankey(graph);
        
        // Validate node coordinates
        sankeyData1.nodes = validateNodeCoordinates(sankeyData1.nodes);
        
        // Function to update diagram
        function updateDiagram(newLinks, nodeFilter = null, transitionDuration = 1000) {
            let nodesToUse = [...data.nodes];
            if (nodeFilter) {
                nodesToUse = data.nodes.filter(nodeFilter);
                newLinks = newLinks.filter(link => {
                    return nodesToUse.some(n => n.id === link.source) &&
                           nodesToUse.some(n => n.id === link.target);
                });
            }
            
            // Ensure nodes are properly ordered by type
            nodesToUse.sort((a, b) => {
                const typeOrder = { 
                    "department": 0, 
                    "approach": 1, 
                    "outcome": 2 };
                return typeOrder[a.type] - typeOrder[b.type];
            });
            
            // Create the new graph with sorted nodes
            const newGraph = {
                nodes: nodesToUse,
                links: newLinks.map(link => ({ ...link }))
            };
            
            // Ensure all links reference valid nodes
            newGraph.links = newGraph.links.filter(link => {
                return newGraph.nodes.some(n => n.id === link.source) && 
                       newGraph.nodes.some(n => n.id === link.target);
            });
            
            const newSankeyData = sankey(newGraph);
            
            // Validate node coordinates
            newSankeyData.nodes = validateNodeCoordinates(newSankeyData.nodes);
            
            // Update links
            const linkUpdate = svg.select(".links")
                .selectAll("path")
                .data(newSankeyData.links, d => `${d.source.id}-${d.target.id}`);
            linkUpdate.exit().remove();
            const newLinkElements = linkUpdate.enter()
                .append("path")
                .attr("class", "link")
                .attr("d", d3.sankeyLinkHorizontal())
                .attr("stroke", d => d3.color(getNodeColor(d.source)).darker(0.5))
                .attr("stroke-width", 0);
            linkUpdate.merge(newLinkElements)
                .transition().on("start", function() { this._current = this._current || {width: 0}; })
                .duration(transitionDuration)
                .attr("d", d3.sankeyLinkHorizontal())
                .attr("stroke-width", d => Math.max(1, d.width));
            
            // Update nodes
            const nodeUpdate = svg.select(".nodes")
                .selectAll("g")
                .data(newSankeyData.nodes, d => d.id);
            nodeUpdate.exit().remove();
                
            nodeUpdate.select("rect")
                .transition().on("start", function() { 
                    // Store current values to interpolate from if not set
                    this._current = this._current || {y0: 0, y1: 1}; 
                })
                .duration(transitionDuration)
                .attr("y", d => {
                    if (isNaN(d.y0)) return 0;
                    return d.y0;
                })
                .attr("height", d => {
                    if (isNaN(d.y0) || isNaN(d.y1)) return 10;
                    return Math.max(1, d.y1 - d.y0);
                });
                
            nodeUpdate.select("text")
                .transition().on("start", function() { this._current = this._current || {y: 10}; })
                .duration(transitionDuration).ease(d3.easeLinear)
                .attr("x", d => d.type === "department" ? d.x0 - 25 : (d.x0 < width / 2 ? d.x1 + 10 : d.x0 - 10))
                .attr("text-anchor", d => (d.type === "department" || d.x0 >= width / 2) ? "end" : "start")
                .attr("y", d => isNaN(d.y0) || isNaN(d.y1) ? 10 : (d.y1 + d.y0) / 2);
            
            // Re-attach tooltip for links
            svg.selectAll(".link")
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", 0.9);
                    const percentage = ((d.value / d.source.value) * 100).toFixed(1);
                    tooltip.html(`<strong>${d.source.name} → ${d.target.name}</strong><br>
                                   Patients: ${d.value}<br>
                                   ${percentage}% of ${d.source.name} patients`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                });
                // Continued from previous code...

// Continued from previous code...

            // Add interactivity for nodes
            svg.selectAll("rect")
                .on("click", function(event, d) {
                    const nodeLinks = data.links.filter(link => {
                        const isSource = (typeof link.source === 'object') ? link.source.id === d.id : link.source === d.id;
                        const isTarget = (typeof link.target === 'object') ? link.target.id === d.id : link.target === d.id;
                        return isSource || isTarget;
                    });
                    const connectedNodes = new Set();
                    nodeLinks.forEach(link => {
                        connectedNodes.add(link.source);
                        connectedNodes.add(link.target);
                    });
                    // Completely hide all nodes that are not connected
                    svg.selectAll(".nodes g")
                        .style("display", node => connectedNodes.has(node.id) ? "block" : "none");
                    svg.selectAll("text")
                        .style("opacity", node => connectedNodes.has(node.id) ? 1 : 0);
                    updateDiagram(nodeLinks);
                    d3.select("#resetBtn").property("disabled", false);
                })
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", 0.9);
                    let incomingValue = 0, outgoingValue = 0;
                    newSankeyData.links.forEach(link => {
                        if (link.target.id === d.id) incomingValue += link.value;
                        if (link.source.id === d.id) outgoingValue += link.value;
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
                    tooltip.transition().duration(500).style("opacity", 0);
                });
            
            setTimeout(cleanupRogueText, 1000);
        }
        
        // Function to determine node color
        function getNodeColor(d) {
            if (d.type === "department") return departmentColor(d.id);
            if (d.type === "approach") return approachColor(d.id);
            if (d.type === "outcome") return outcomeColor(d.id);
            return "#ccc";
        }
        
        // Create initial SVG groups
        svg.append("g").attr("class", "links");
        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(sankeyData1.nodes, d => d.id)
            .enter().append("g");
        
        node.append("rect")
            .attr("x", d => d.x0 || 0)
            .attr("y", d => d.y0 || 0)
            .attr("height", function(d) {
                return Math.max(1, (d.y1 || 1) - (d.y0 || 0));
            })
            .attr("width", d => {
                return Math.max(1, (d.x1 || 20) - (d.x0 || 0));
            })
            .attr("fill", d => getNodeColor(d))
            .attr("stroke", d => d3.color(getNodeColor(d)).darker(0.5))
                    // Add hover functionality
                    .on("mouseover", function(event, d) {
                        tooltip.transition().duration(200).style("opacity", 0.9);
                        
                        // Calculate total patients for this department
                        const totalPatients = data.links.filter(link => {
                            return (typeof link.source === 'object' ? link.source.id : link.source) === d.id;
                        }).reduce((sum, link) => sum + link.value, 0);
                        
                        let tooltipContent = `<strong>${d.name}</strong><br>Total patients: ${totalPatients}<br>Click to focus on this department's pathways`;
                        
                        tooltip.html(tooltipContent)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function() {
                        tooltip.transition().duration(500).style("opacity", 0);
                    })
                    // Add click functionality to filter diagram
                    .on("click", function(event, d) {
                        // Stop event propagation to prevent tooltip interference
                        event.stopPropagation();
                        event.preventDefault();
                        
                        // Move to step 3 (full diagram) to ensure all nodes are loaded
                        currentAnimationStep = 2;
                        runAnimation();
                        
                        // After a short delay to ensure diagram is fully loaded
                        setTimeout(() => {
                        // Implement step-by-step progression for the selected node
                        
                        // First, hide all nodes except the selected one
                        const nodeLinks = data.links.filter(link => {
                            return (typeof link.source === 'object' ? link.source.id : link.source) === d.id;
                        });
                        const connectedNodes = new Set();
                        connectedNodes.add(d.id);
                        nodeLinks.forEach(link => {
                            connectedNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
                        });
                        
                        // Completely hide all nodes that are not connected
                        svg.selectAll(".nodes g")
                            .style("display", function(node) {
                                return connectedNodes.has(node.id) ? "block" : "none";
                            });
                        
                        // Also hide unrelated links
                        svg.selectAll(".link")
                            .style("display", function(link) {
                                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                                return (sourceId === d.id || targetId === d.id) ? "block" : "none";
                            });
                        
                        // Show only the links connected to this node
                        updateDiagram(nodeLinks);
                        
                        // Enable the reset button
                        d3.select("#resetBtn").property("disabled", false);
                        }, 500); // End of setTimeout
                    });
        
        node.append("text")
            .attr("x", function(d) {
                if (d.x0 === undefined || isNaN(d.x0)) return 0;
                return d.type === "department" ? d.x0 - 25 : (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6);
            })
            .attr("y", function(d) {
                if (d.y0 === undefined || isNaN(d.y0) || d.y1 === undefined || isNaN(d.y1)) return 10;
                return (d.y1 + d.y0) / 2;
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", d => (d.type === "department" || d.x0 >= width / 2) ? "end" : "start")
            .attr("font-size", "12px")
            .attr("font-weight", d => d.type === "department" ? "bold" : "normal")
            .text(d => (d.x0 === undefined || isNaN(d.x0) || d.y0 === undefined || isNaN(d.y0)) ? "" : d.name || d.id)
            .style("pointer-events", "none");
        
        // Label collision detection
        function fixLabelOverlap() {
            const textElements = svg.selectAll(".nodes text");
            const labels = [];
            
            // First, ensure all text elements have valid coordinates
            textElements.each(function() {
                const textElement = d3.select(this);
                const y = parseFloat(textElement.attr("y"));
                if (isNaN(y)) {
                    textElement.attr("y", 10);
                }
            });
            textElements.each(function(d) {
                const bbox = this.getBBox();
                labels.push({ element: this, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, data: d });
            });
            const departmentLabels = labels.filter(l => l.data.type === "department").sort((a, b) => a.y - b.y);
            const approachLabels = labels.filter(l => l.data.type === "approach").sort((a, b) => a.y - b.y);
            const outcomeLabels = labels.filter(l => l.data.type === "outcome").sort((a, b) => a.y - b.y);
            function adjustLabels(typeLabels) {
                for (let i = 1; i < typeLabels.length; i++) {
                    const current = typeLabels[i];
                    const previous = typeLabels[i - 1];
                    // Skip if coordinates are invalid
                    if (isNaN(previous.y) || isNaN(current.y)) continue;
                    
                    const overlap = previous.y + previous.height + 5 - current.y;
                    if (overlap > 0) {
                        d3.select(current.element).attr("y", parseFloat(d3.select(current.element).attr("y")) + overlap);
                    }
                }
            }
            adjustLabels(departmentLabels);
            adjustLabels(approachLabels);
            adjustLabels(outcomeLabels);
        }
        
        // Remove any rogue text elements
        function cleanupRogueText() {
            svg.selectAll("text").each(function() {
                try {
                let textElement = d3.select(this);
                const x = parseFloat(textElement.attr("x"));
                if (isNaN(x)) textElement.attr("x", 10);
                const y = parseFloat(textElement.attr("y"));
                const content = textElement.text();
                const suspiciousText = content.includes("gy") || content.includes("Open") ||
                                       content.includes("Videoscopic") || content.includes("Robotic") ||
                                       content.includes("Survived");
                if ((x < -20 && y < 50) || (isNaN(x) || isNaN(y)) ||
                    (suspiciousText && (x < 100 || y < 100))) {
                    textElement.attr("x", -1000).attr("y", -1000); // Move off-screen instead of removing
                    console.log(`Removed suspicious text: "${content}" at (${x}, ${y})`);
                }
                } catch (e) {
                    console.error("Error cleaning up text:", e);
                }
            });
        }
        
        // Animation Control
        const animationSteps = [
            {
                name: "Departments",
                filter: null, // Will be set to only show departments
                links: [], // No links in step 1
                positionNodes: true, // Flag to ensure nodes are properly positioned
                customLayout: true // Flag to use custom layout for step 1
            },
            {
                name: "Departments and Approaches",
                filter: (node) => ["department", "approach"].includes(node.type),
                links: function() {
                    return data.links.filter(link => {
                        const sourceNode = data.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
                        const targetNode = data.nodes.find(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target));
                        return sourceNode && targetNode && 
                               sourceNode.type === "department" && targetNode.type === "approach";
                    });
                }
            },
            {
                name: "Full Diagram",
                filter: () => true,
                links: function() { return data.links; }
            }
        ];

        let currentAnimationStep = 0;

        function runAnimation() {
            // Ensure we're using the correct step
            const step = animationSteps[currentAnimationStep];
            
            // Prepare links - call function if it's a function, otherwise use as-is
            const linksToShow = typeof step.links === 'function' 
                ? step.links() 
                : step.links;
            
            // Special handling for Step 1
            if (currentAnimationStep === 0) {
                // Clear existing content
                svg.selectAll(".nodes g").remove();
                svg.selectAll(".links path").remove();
                
                // Only show department nodes with custom positioning
                const departmentNodes = data.nodes.filter(n => n.type === "department");
                const width = document.getElementById("chart").clientWidth - 40;
                const height = document.getElementById("chart").clientHeight - 40;
                
                // Create department nodes with proper positioning
                const nodeSpacing = height / (departmentNodes.length + 1);
                
                // Position all nodes at the far left edge of the display area
                const leftPosition = 20; // Reduced from 40 to position at the far left edge
                const nodeGroup = svg.select(".nodes")
                    .selectAll("g.department-node")
                    .data(departmentNodes)
                    .enter()
                    .append("g");
                
                nodeGroup.append("rect")
                    .attr("x", leftPosition) // Position at the far left
                    .attr("y", (d, i) => (i + 1) * nodeSpacing)
                    .attr("height", 30)
                    .attr("width", 20)
                    .attr("fill", d => getNodeColor(d))
                    .attr("stroke", d => d3.color(getNodeColor(d)).darker(0.5))
                    .style("cursor", "pointer")
                    // Add hover functionality
                    .on("mouseover", function(event, d) {
                        tooltip.transition().duration(200).style("opacity", 0.9);
                        
                        // Calculate total patients for this department
                        const totalPatients = data.links.filter(link => {
                            return (typeof link.source === 'object' ? link.source.id : link.source) === d.id;
                        }).reduce((sum, link) => sum + link.value, 0);
                        
                        let tooltipContent = `<strong>${d.name}</strong><br>Total patients: ${totalPatients}<br>Click to focus on this department's pathways`;
                        
                        tooltip.html(tooltipContent)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function() {
                        tooltip.transition().duration(500).style("opacity", 0);
                    })
                    // Add click functionality to filter diagram
                    .on("click", function(event, d) {
                        // Stop event propagation to prevent tooltip interference
                        event.stopPropagation();
                        event.preventDefault();
                        
                        // Move to step 3 (full diagram) to ensure all nodes are loaded
                        currentAnimationStep = 2;
                        runAnimation();
                        
                        // After a short delay to ensure diagram is fully loaded
                        setTimeout(() => {
                        // Implement step-by-step progression for the selected node
                        
                        // First, hide all nodes except the selected one
                        const nodeLinks = data.links.filter(link => {
                            return (typeof link.source === 'object' ? link.source.id : link.source) === d.id;
                        });
                        const connectedNodes = new Set();
                        connectedNodes.add(d.id);
                        nodeLinks.forEach(link => {
                            connectedNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
                        });
                        
                        // Completely hide all nodes that are not connected
                        svg.selectAll(".nodes g")
                            .style("display", function(node) {
                                return connectedNodes.has(node.id) ? "block" : "none";
                            });
                        
                        // Also hide unrelated links
                        svg.selectAll(".link")
                            .style("display", function(link) {
                                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                                return (sourceId === d.id || targetId === d.id) ? "block" : "none";
                            });
                        
                        // Show only the links connected to this node
                        updateDiagram(nodeLinks);
                        
                        // Enable the reset button
                        d3.select("#resetBtn").property("disabled", false);
                        }, 500); // End of setTimeout
                    });
                
                // Text is removed as hover functionality provides this information effectively
                
                // Update step indicators
                d3.selectAll(".step").classed("active", (d, i) => i <= currentAnimationStep);
                
                // Manage button states
                d3.select("#prevBtn").property("disabled", currentAnimationStep === 0);
                d3.select("#nextBtn").property("disabled", currentAnimationStep === animationSteps.length - 1);
                
                return; // Skip the regular update for step 1
            }
            
            // Update diagram with filtered nodes and links
            updateDiagram(linksToShow, step.filter);

            // Update step indicators
            d3.selectAll(".step")
                .classed("active", (d, i) => i <= currentAnimationStep);

            // Manage button states
            d3.select("#prevBtn").property("disabled", currentAnimationStep === 0);
            d3.select("#nextBtn").property("disabled", currentAnimationStep === animationSteps.length - 1);

            // Cleanup
            setTimeout(fixLabelOverlap, 800);
            setTimeout(cleanupRogueText, 1000);
        }

        // Control Buttons
        d3.select("#animateBtn").on("click", function() {
            // Reset to first step and clear the diagram
            currentAnimationStep = 0;
            
            // Clear existing content
            svg.selectAll(".nodes g").remove();
            svg.selectAll(".links path").remove();
            
            // Change button state
            const animateBtn = d3.select(this);
            animateBtn.property("disabled", true).text("Animating...");
            
            // Run animation with proper timing
            setTimeout(() => { runAnimation(); }, 100);
            setTimeout(() => { currentAnimationStep = 1; runAnimation(); }, 1500);
            setTimeout(() => { currentAnimationStep = 2; runAnimation(); }, 3000);
            setTimeout(() => { animateBtn.property("disabled", false).text("Animate Diagram"); }, 4500);
        });

        d3.select("#prevBtn").on("click", function() {
            if (currentAnimationStep > 0) {
                // Ensure all nodes are visible when navigating steps
                svg.selectAll(".nodes g").style("display", "block");
                svg.selectAll(".link").style("display", "block");
                svg.selectAll("rect").style("opacity", 1).style("pointer-events", "auto");
                svg.selectAll("text").style("opacity", 1);
                
                currentAnimationStep--;
                runAnimation();
            }
        });

        d3.select("#nextBtn").on("click", function() {
            if (currentAnimationStep < animationSteps.length - 1) {
                // Ensure all nodes are visible when navigating steps
                svg.selectAll(".nodes g").style("display", "block");
                svg.selectAll(".link").style("display", "block");
                svg.selectAll("rect").style("opacity", 1).style("pointer-events", "auto");
                svg.selectAll("text").style("opacity", 1);
                
                currentAnimationStep++;
                runAnimation();
            }
            
            // Fix any remaining NaN issues
            setTimeout(cleanupRogueText, 1200);
        });

        d3.select("#resetBtn").on("click", function() {
            // Reset to full diagram and restore default layout
            currentAnimationStep = animationSteps.length - 1;
            
            // Ensure all nodes are visible
            svg.selectAll(".nodes g").style("display", "block");
            svg.selectAll("rect").style("opacity", 1).style("pointer-events", "auto");
            svg.selectAll("text").style("opacity", 1);
            
            // Reset any zoom or pan transformations
                svg.transition().duration(750)
                    .attr("transform", `translate(${margin.left},${margin.top}) scale(1)`);
                
                // Make all links visible again
                svg.selectAll(".link").style("display", "block");
                
            runAnimation();
        });

        // Add click handlers to step indicators
        d3.selectAll(".step").on("click", function(event) {
            const steps = d3.selectAll(".step").nodes();
            const index = steps.indexOf(this);
            currentAnimationStep = index;
            // Ensure all nodes are visible when changing steps
            svg.selectAll(".nodes g").style("display", "block");
            svg.selectAll(".link").style("display", "block");
            runAnimation();
        });
        

        // Create legend
        d3.select(".legend").remove();
        const legend = d3.select(".container").append("div").attr("class", "legend");
        
        // Department legend
        const departmentLegend = legend.append("div").attr("class", "legend-section");
        departmentLegend.append("h4").text("Departments");
        const departmentItems = departmentLegend.selectAll(".legend-item")
            .data(departmentColor.domain())
            .enter().append("div").attr("class", "legend-item");
        departmentItems.append("div")
            .attr("class", "legend-color")
            .style("background-color", d => departmentColor(d));
        departmentItems.append("div").text(d => d);
        
        // Approach legend
        const approachLegend = legend.append("div").attr("class", "legend-section");
        approachLegend.append("h4").text("Approaches");
        const approachItems = approachLegend.selectAll(".legend-item")
            .data(approachColor.domain())
            .enter().append("div").attr("class", "legend-item");
        approachItems.append("div")
            .attr("class", "legend-color")
            .style("background-color", d => approachColor(d));
        approachItems.append("div").text(d => d);
        
        // Outcome legend
        const outcomeLegend = legend.append("div").attr("class", "legend-section");
        outcomeLegend.append("h4").text("Outcomes");
        const outcomeItems = outcomeLegend.selectAll(".legend-item")
            .data(outcomeColor.domain())
            .enter().append("div").attr("class", "legend-item");
        outcomeItems.append("div")
            .attr("class", "legend-color")
            .style("background-color", d => outcomeColor(d));
        outcomeItems.append("div").text(d => d);

        // Initial setup
        runAnimation();
    } catch (error) {
        console.error("Error creating Sankey diagram:", error);
        d3.select("#chart").html("<div class='loading'>Error creating visualization. Using sample data instead.</div>");
    }
}

// On initial load and on resize
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    window.addEventListener('resize', function() {
        if (sankeyData) {
            createSankeyDiagram();
        }
    });
});
