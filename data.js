import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 1. Initialize Connections
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY);
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function enrichHospitalsWithGroq() {
  console.log("Fetching empty hospital rows from Supabase...");
  const { data: hospitals, error } = await supabase.from('hospitals').select('id, name').is('tier', null);
  
  if (error) return console.error(error);
  if (hospitals.length === 0) return console.log("All hospitals are already enriched!");

  console.log(`Found ${hospitals.length} pending hospitals. Firing up Groq...`);

  const BATCH_SIZE = 20;
  
  for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
    const chunk = hospitals.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch [${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(hospitals.length/BATCH_SIZE)}]...`);

    const hospitalListString = chunk.map((h, index) => `Index: ${index} | Name: ${h.name}`).join('\n');
    
    const prompt = `
      Evaluate the following list of hospitals in Bengaluru, India. 
      Return ONLY a raw JSON object with a single key "hospitals" containing an array of objects.
      
      HOSPITALS:
      ${hospitalListString}
      
      Array item schema:
      {
        "index": The exact integer index provided,
        "tier": 1 (Major Hub), 2 (Regional), or 3 (Local Clinic),
        "popularity_score": Score from 1 to 100
      }
    `;

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant", 
        response_format: { type: "json_object" }, 
      });

      const responseText = chatCompletion.choices[0].message.content;
      
      // DEBUG: Print the raw AI response for the very first batch
      if (i === 0) {
          console.log("🕵️ RAW AI RESPONSE:");
          console.log(responseText);
      }

      let parsed = JSON.parse(responseText);
      // Fallback in case Llama forgets the "hospitals" wrapper
      const evaluatedData = parsed.hospitals || parsed; 

      let successCount = 0;

      for (const item of evaluatedData) {
        // BULLETPROOF PARSING: Catch capitalized keys!
        const rawIndex = item.index ?? item.Index;
        const rawTier = item.tier ?? item.Tier;
        const rawPop = item.popularity_score ?? item.Popularity_score ?? item.PopularityScore ?? item.popularityScore;

        const arrayIndex = parseInt(rawIndex);
        
        if (isNaN(arrayIndex) || !chunk[arrayIndex]) {
            console.log(`⚠️ Skipped item due to bad index:`, item);
            continue;
        }

        const realDbId = chunk[arrayIndex].id;

        // Force Supabase to return data so we know the write actually succeeded
        const { data, error: updateError } = await supabase.from('hospitals')
          .update({ tier: parseInt(rawTier), popularity_score: parseInt(rawPop) })
          .eq('id', realDbId)
          .select();

        if (updateError) {
            console.error(`❌ DB Error on index ${arrayIndex}:`, updateError.message);
        } else if (!data || data.length === 0) {
            console.error(`⚠️ DB Error: Could not find row for index ${arrayIndex}`);
        } else {
            successCount++;
        }
      }

      console.log(`✅ Batch finished. Successfully wrote ${successCount}/${chunk.length} entries to Supabase.`);
      await sleep(2000); 

    } catch (err) {
      console.log(`⚠️ Batch failed: ${err.message}`);
      console.log("Taking a 10-second breather...");
      await sleep(10000); 
    }
  }
  console.log("\n🚀 Pipeline complete!");
}

enrichHospitalsWithGroq();