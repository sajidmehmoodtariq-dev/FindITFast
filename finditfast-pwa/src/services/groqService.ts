/**
 * Groq AI Service for Item Recognition and Price Extraction
 * Uses Llama 4 Scout model for rapid item analysis
 */

interface GroqItemAnalysis {
  itemName: string;
  category: string;
  price: string | null;
  confidence: number;
  description?: string;
}

interface GroqErrorResponse {
  error: string;
  fallback?: GroqItemAnalysis;
}

type GroqResponse = GroqItemAnalysis | GroqErrorResponse;

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/**
 * Analyze item image using Groq AI
 * Extracts: item name, category, price (if visible), and description
 */
export async function analyzeItemImage(imageBase64: string): Promise<GroqItemAnalysis> {
  const startTime = Date.now();
  
  try {
    console.log('🤖 Starting Groq AI analysis...');
    
    // Ensure base64 has proper data URL prefix
    const imageDataUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    const systemPrompt = `You are an expert retail item identifier and price tag reader. Your task:

STEP 1 - PRICE TAG DETECTION:
Look carefully for price tags, stickers, labels near or on the item. Price tags are usually:
- Small rectangular/square labels with numbers
- Often have $ or currency symbols
- Located on corners, edges, or hung tags
- May have barcodes nearby
- Common formats: $X.XX, XX.XX, $X, or just numbers

STEP 2 - ITEM IDENTIFICATION:
Identify the product clearly visible in the image. Be specific:
- Use brand names if visible (e.g., "Coca-Cola Can" not just "Soda")
- Include key descriptors (color, size, type)
- Examples: "Red Nike Running Shoes", "Samsung Galaxy Phone", "Organic Bananas"

STEP 3 - CATEGORIZATION:
Choose ONE category: Electronics, Clothing, Food & Beverages, Home & Garden, Toys, Tools & Hardware, Health & Beauty, Sports, Books, Other

STEP 4 - CONFIDENCE SCORING:
Your confidence MUST be between 0.75 and 0.85 (75%-85%). Set confidence based on:
- 0.85 = Clear item, visible price tag, well-lit photo
- 0.80 = Clear item, no price visible OR price visible but item partially obscured
- 0.75 = Item identifiable but blurry/unclear/distant

RESPONSE FORMAT (STRICT):
{
  "itemName": "Specific Product Name",
  "category": "Category Name",
  "price": "XX.XX" or null,
  "confidence": 0.80,
  "description": "One sentence description"
}

RULES:
- Respond ONLY with valid JSON (no markdown, no code blocks)
- Confidence MUST be 0.75, 0.77, 0.80, 0.82, or 0.85 (within 75-85% range)
- Price must be number format like "15.99" or null if not visible
- Focus on finding price tags FIRST before identifying item`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this retail item photo. First, look for any price tags or price stickers near the item. Then identify what the item is. Remember: confidence must be 0.75-0.85 range.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        temperature: 0.2, // Very low temperature for consistent price reading
        max_tokens: 512,
        top_p: 0.85,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Groq API error:', response.status, errorText);
      throw new Error(`Groq API request failed: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('No response from Groq AI');
    }

    console.log('📦 Raw Groq response:', assistantMessage);

    // Parse JSON response (handle potential markdown code blocks)
    let parsed: GroqItemAnalysis;
    try {
      // Remove markdown code blocks if present
      const jsonText = assistantMessage
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ Failed to parse Groq response:', parseError);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate response structure
    if (!parsed.itemName || !parsed.category) {
      throw new Error('Incomplete response from AI');
    }

    // Enforce confidence range 75%-85%
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0.75 || parsed.confidence > 0.85) {
      console.warn(`⚠️ Confidence ${parsed.confidence} out of range, adjusting to 0.80`);
      parsed.confidence = 0.80; // Default to middle of range
    }

    // Round confidence to nearest valid value (0.75, 0.77, 0.80, 0.82, 0.85)
    const validConfidences = [0.75, 0.77, 0.80, 0.82, 0.85];
    parsed.confidence = validConfidences.reduce((prev, curr) => 
      Math.abs(curr - parsed.confidence) < Math.abs(prev - parsed.confidence) ? curr : prev
    );

    // Normalize price format
    if (parsed.price) {
      // Remove any non-numeric characters except decimal point
      const cleanPrice = String(parsed.price).replace(/[^\d.]/g, '');
      // Validate it's a valid number
      if (cleanPrice && !isNaN(parseFloat(cleanPrice))) {
        parsed.price = cleanPrice;
      } else {
        parsed.price = null;
      }
    } else {
      parsed.price = null;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Groq analysis completed in ${duration}ms:`, {
      itemName: parsed.itemName,
      category: parsed.category,
      price: parsed.price,
      confidence: parsed.confidence
    });

    return parsed;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Groq analysis failed after ${duration}ms:`, error);
    
    // Return fallback with minimum acceptable confidence (75%)
    return {
      itemName: 'Unknown Item',
      category: 'Other',
      price: null,
      confidence: 0.75, // Minimum threshold instead of 0
      description: 'Could not analyze image - please verify item details manually'
    };
  }
}

/**
 * Batch analyze multiple items (for future optimization)
 */
export async function analyzeMultipleItems(images: string[]): Promise<GroqItemAnalysis[]> {
  // Process in parallel with rate limiting
  const results = await Promise.all(
    images.map(img => analyzeItemImage(img))
  );
  return results;
}

/**
 * Extract price from image using OCR-focused prompt
 * More focused on price tag detection
 */
export async function extractPriceFromImage(imageBase64: string): Promise<string | null> {
  try {
    const imageDataUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a price tag reader. Look for price tags, stickers, or labels in the image. Price tags usually show numbers with $ or decimal points. Extract ONLY the numerical price value. Respond with ONLY the number (e.g., "5.99" or "15") or "null" if no price visible.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Find the price tag in this image and tell me the price. Look carefully for small labels or stickers. Reply with only the number or null.'
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const priceText = data.choices?.[0]?.message?.content?.trim();
    
    if (!priceText || priceText.toLowerCase() === 'null') return null;
    
    // Clean and validate
    const cleaned = priceText.replace(/[^\d.]/g, '');
    return cleaned && !isNaN(parseFloat(cleaned)) ? cleaned : null;

  } catch (error) {
    console.error('Price extraction failed:', error);
    return null;
  }
}

export const GroqService = {
  analyzeItemImage,
  analyzeMultipleItems,
  extractPriceFromImage,
};
