const { callOpenAI } = require('./dist/utils/openaiClient');
const { TokenCounter } = require('./dist/utils/tokenCounter');

async function testBatchProcessing() {
  const prompts = [
    { message: "What is 2+2?", systemPrompt: "You are a helpful math tutor." },
    { message: "Tell me a short joke about programming.", systemPrompt: "You are a witty comedian." },
    { message: "Explain photosynthesis in one sentence.", systemPrompt: "You are a science teacher." }
  ];
  
  console.log('🚀 Starting Live Batch Processing Test!');
  console.log(`Processing ${prompts.length} prompts...\n`);
  
  const tokenCounter = new TokenCounter();
  const startTime = Date.now();
  
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`\n[${i+1}/${prompts.length}] Processing: "${prompt.message}"`);
    
    try {
      const response = await callOpenAI(
        prompt.message,
        prompt.systemPrompt,
        { command: 'batch-test' }
      );
      
      console.log(`✅ Response: ${response.slice(0, 100)}${response.length > 100 ? '...' : ''}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Batch complete! Total time: ${duration}s`);
}

testBatchProcessing().catch(console.error);