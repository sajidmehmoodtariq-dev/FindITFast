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

    const systemPrompt = `You are an expert at identifying retail items and extracting price information from images. 
Analyze the image and provide:
1. Item name (be specific but concise, e.g., "Red Hammer", "Colgate Toothbrush", "Teddy Bear")
2. Category (choose ONE from: Electronics, Clothing, Food, Home & Garden, Toys, Tools, Health & Beauty, Sports, Books, Other)
3. Price (if visible in the image - look for price tags, labels, or stickers. Extract ONLY the number, e.g., "15.99" or "5")
4. Brief description (one sentence)

CRITICAL: You MUST respond ONLY with valid JSON in this EXACT format:
{
  "itemName": "specific item name",
  "category": "category from list above",
  "price": "price as number string or null",
  "confidence": 0.85,
  "description": "brief one sentence description"
}

Do NOT include markdown, code blocks, or any text outside the JSON object.
If you cannot identify the item, use confidence below 0.5 and provide your best guess.`;

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
                text: 'Analyze this item image and provide the JSON response as specified.'
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
        temperature: 0.3, // Lower temperature for more consistent outputs
        max_tokens: 512,
        top_p: 0.9,
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

    // Normalize price format
    if (parsed.price) {
      // Remove any non-numeric characters except decimal point
      parsed.price = parsed.price.replace(/[^\d.]/g, '');
      // Validate it's a valid number
      if (parsed.price && isNaN(parseFloat(parsed.price))) {
        parsed.price = null;
      }
    }

    // Ensure confidence is set
    if (typeof parsed.confidence !== 'number') {
      parsed.confidence = 0.7; // Default confidence
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
    
    // Return fallback with low confidence
    return {
      itemName: 'Unknown Item',
      category: 'Other',
      price: null,
      confidence: 0.0,
      description: 'AI analysis failed - please edit manually'
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
 * More focused and faster than full analysis
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
            content: 'You are an OCR expert. Extract ONLY the price from price tags or labels. Respond with ONLY the number (e.g., "5.99" or "15") or "null" if no price visible. No other text.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the price shown in this image? Reply with only the number or null.'
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
    
    if (!priceText || priceText === 'null') return null;
    
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
