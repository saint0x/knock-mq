// Realistic job processing simulations for production-grade testing

export async function simulateEmailProcessing(data: any) {
  // Simulate template rendering, validation, SMTP connection
  const template = generateEmailTemplate(data);
  await simulateNetworkCall(50, 200); // SMTP latency
  validateEmailData(template);
  
  // Random failures (network issues, invalid emails, etc.)
  if (Math.random() < 0.05) {
    throw new Error('SMTP server unavailable');
  }
}

export async function simulatePaymentProcessing(data: any) {
  // Simulate payment validation, fraud detection, API calls
  validatePaymentData(data);
  await simulateNetworkCall(100, 500); // Payment gateway latency
  performFraudCheck(data);
  await simulateNetworkCall(50, 150); // Database update
  
  // Random failures (payment declined, network timeout, etc.)
  if (Math.random() < 0.08) {
    throw new Error('Payment gateway timeout');
  }
}

export async function simulateAnalyticsProcessing(data: any) {
  // Simulate data aggregation, calculations, database writes
  const processedData = aggregateAnalyticsData(data);
  performCalculations(processedData);
  await simulateNetworkCall(20, 100); // Database write
  
  // Random failures (database connection issues)
  if (Math.random() < 0.03) {
    throw new Error('Database connection failed');
  }
}

export async function simulateImageProcessing(data: any) {
  // Simulate CPU-intensive image operations
  performImageOperations(data);
  await simulateNetworkCall(200, 800); // S3 upload
  generateThumbnails(data);
  
  // Random failures (processing errors, storage issues)
  if (Math.random() < 0.06) {
    throw new Error('Image processing failed');
  }
}

export async function simulateGenericProcessing(data: any) {
  // Basic processing with some CPU work
  performBasicValidation(data);
  await simulateNetworkCall(30, 150);
  
  if (Math.random() < 0.04) {
    throw new Error('Generic processing error');
  }
}

// Email processing utilities
function generateEmailTemplate(data: any): string {
  // Simulate template rendering with string operations
  let template = `Hello ${data?.userId || 'User'},\n\n`;
  for (let i = 0; i < 100; i++) {
    template += `Line ${i}: ${JSON.stringify(data)}\n`;
  }
  return template;
}

function validateEmailData(template: string) {
  // Simulate validation with regex and parsing
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const lines = template.split('\n');
  lines.forEach(line => {
    if (line.includes('@')) {
      emailRegex.test(line);
    }
  });
}

// Payment processing utilities
function validatePaymentData(data: any) {
  // Simulate payment validation with calculations
  const amount = data?.amount || Math.random() * 1000;
  const fees = amount * 0.029 + 0.30; // Stripe-like fee calculation
  const total = amount + fees;
  
  // Simulate validation checks
  if (amount < 0.50) throw new Error('Amount too small');
  if (amount > 10000) throw new Error('Amount too large');
  
  // Simulate luhn algorithm for card validation
  const cardNumber = '4111111111111111';
  let sum = 0;
  for (let i = 0; i < cardNumber.length; i++) {
    const char = cardNumber[i];
    if (char) {
      let digit = parseInt(char);
      if (i % 2 === 0) digit *= 2;
      if (digit > 9) digit -= 9;
      sum += digit;
    }
  }
}

function performFraudCheck(data: any) {
  // Simulate fraud detection algorithms
  const riskFactors = [];
  const amount = data?.amount || 0;
  const userId = data?.userId || '';
  
  // Simulate various risk calculations
  if (amount > 1000) riskFactors.push('high_amount');
  if (userId.includes('test')) riskFactors.push('test_user');
  
  // Simulate ML model scoring (CPU intensive)
  let riskScore = 0;
  for (let i = 0; i < 1000; i++) {
    riskScore += Math.sin(i) * Math.cos(amount) * Math.random();
  }
  
  if (riskScore > 500) {
    throw new Error('Transaction flagged as fraudulent');
  }
}

// Analytics processing utilities
function aggregateAnalyticsData(data: any) {
  // Simulate data aggregation with array operations
  const events = [];
  for (let i = 0; i < 500; i++) {
    events.push({
      timestamp: Date.now() - Math.random() * 86400000,
      value: Math.random() * 100,
      category: ['view', 'click', 'purchase'][Math.floor(Math.random() * 3)]
    });
  }
  
  // Group and aggregate
  const grouped = events.reduce((acc, event) => {
    const category = event.category;
    if (category) {
      acc[category] = (acc[category] || 0) + event.value;
    }
    return acc;
  }, {} as Record<string, number>);
  
  return grouped;
}

function performCalculations(data: any) {
  // Simulate statistical calculations
  const values = Object.values(data).filter(v => typeof v === 'number') as number[];
  if (values.length === 0) return;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Simulate more complex calculations
  for (let i = 0; i < 100; i++) {
    Math.pow(stdDev, Math.random());
  }
}

// Image processing utilities
function performImageOperations(data: any) {
  // Simulate CPU-intensive image processing
  const width = 1920;
  const height = 1080;
  const pixels = new Array(width * height);
  
  // Simulate image filters
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = {
      r: Math.floor(Math.random() * 255),
      g: Math.floor(Math.random() * 255),
      b: Math.floor(Math.random() * 255)
    };
  }
  
  // Simulate blur filter (CPU intensive)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (pixels[idx] && pixels[idx - 1] && pixels[idx + 1]) {
        pixels[idx].r = (pixels[idx - 1].r + pixels[idx].r + pixels[idx + 1].r) / 3;
      }
    }
  }
}

function generateThumbnails(data: any) {
  // Simulate thumbnail generation
  const sizes = [150, 300, 600];
  sizes.forEach(size => {
    const thumbnailPixels = new Array(size * size);
    for (let i = 0; i < thumbnailPixels.length; i++) {
      thumbnailPixels[i] = Math.floor(Math.random() * 255);
    }
  });
}

// Generic utilities
function performBasicValidation(data: any) {
  // Simulate basic data validation and transformation
  const jsonString = JSON.stringify(data || {});
  const parsed = JSON.parse(jsonString);
  
  // Simulate schema validation
  const requiredFields = ['type', 'userId', 'data'];
  requiredFields.forEach(field => {
    if (!parsed[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  });
  
  // Simulate data transformation
  const transformed = {
    ...parsed,
    processedAt: new Date().toISOString(),
    hash: btoa(jsonString).slice(0, 16)
  };
}

export async function simulateNetworkCall(minMs: number, maxMs: number) {
  // Simulate realistic network latency with jitter
  const baseLatency = minMs + Math.random() * (maxMs - minMs);
  const jitter = Math.random() * 20 - 10; // ±10ms jitter
  const totalLatency = Math.max(baseLatency + jitter, 1);
  
  return new Promise(resolve => setTimeout(resolve, totalLatency));
} 