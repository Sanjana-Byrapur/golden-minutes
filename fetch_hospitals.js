// This script queries Overpass for Bengaluru hospitals using a secure POST request

async function getHospitals() {
  console.log("Fetching hospitals from OpenStreetMap...");
  
  // Overpass Query: Look for hospitals in a specific bounding box (Bengaluru)
  const query = `
    [out:json][timeout:25];
    node["amenity"="hospital"](12.8340,77.4649,13.1436,77.7400); 
    out body;
  `;

  try {
    // Send as a POST request to bypass URL encoding limits and GET throttling
    // Send as a POST request with explicit Accept and User-Agent headers
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'GoldenMinutes-EmergencyApp/1.0'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}...`);
    }

    const data = await response.json();
    
    console.log(`\n✅ Found ${data.elements.length} hospitals. Generating SQL...\n`);
    
    // Generate the SQL Insert commands
    let sqlString = `INSERT INTO hospitals (name, specialty, location, available_beds) VALUES \n`;
    
    const validHospitals = data.elements.filter(h => h.tags && h.tags.name);
    
    // Iterate through EVERY valid hospital found
    validHospitals.forEach((h, index) => {
      const name = h.tags.name.toLowerCase();
      const specialty = name.includes('heart') || name.includes('cardiac') ? 'cardiac' : 'general';
      
      const randomBeds = Math.floor(Math.random() * 14) + 2; 

      // Check against the full array length now
      const isLast = index === validHospitals.length - 1;
      
      const cleanName = h.tags.name.replace(/'/g, "''");
      
      sqlString += `('${cleanName}', '${specialty}', st_setsrid(st_makepoint(${h.lon}, ${h.lat}), 4326), ${randomBeds})${isLast ? ';' : ','}\n`;
    });
    
    console.log("--- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR ---\n");
    console.log(sqlString);
    console.log("\n----------------------------------------------------\n");
    
  } catch (error) {
    console.error("Pipeline failed:", error);
  }
}

getHospitals();