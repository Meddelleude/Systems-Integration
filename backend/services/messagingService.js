const amqp = require('amqplib');
const { EventEmitter } = require('events');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const ORDERS_REQUEST_QUEUE = 'orders.request';
const ORDERS_RESPONSE_QUEUE = 'orders.response';

class MessagingService extends EventEmitter {
  constructor() {
    super();
    this.connection = null;
    this.channel = null;
    this.responseHandlers = new Map(); // correlationId -> { resolve, reject, timeout }
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log(`🔌 Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();

      // Declare queues (idempotent)
      await this.channel.assertQueue(ORDERS_REQUEST_QUEUE, { durable: true });
      await this.channel.assertQueue(ORDERS_RESPONSE_QUEUE, { durable: true });

      // Start consuming responses
      await this.startResponseConsumer();

      this.isConnected = true;
      console.log('✅ RabbitMQ connected and consuming responses');

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        console.warn('⚠️  RabbitMQ connection closed');
        this.isConnected = false;
      });

      return true;
    } catch (err) {
      console.error('❌ Failed to connect to RabbitMQ:', err.message);
      this.isConnected = false;
      throw err;
    }
  }

  async startResponseConsumer() {
    await this.channel.consume(ORDERS_RESPONSE_QUEUE, (msg) => {
      if (!msg) return;

      try {
        const correlationId = msg.properties.correlationId;
        const content = msg.content.toString();
        
        console.log(`📨 Received response for correlationId: ${correlationId}`);

        const handler = this.responseHandlers.get(correlationId);
        if (handler) {
          clearTimeout(handler.timeout);
          
          try {
            const response = JSON.parse(content);
            handler.resolve(response);
          } catch (parseErr) {
            handler.reject(new Error(`Invalid JSON response: ${content}`));
          }

          this.responseHandlers.delete(correlationId);
        } else {
          console.warn(`⚠️  No handler found for correlationId: ${correlationId}`);
        }

        this.channel.ack(msg);
      } catch (err) {
        console.error('❌ Error processing response message:', err);
        this.channel.nack(msg, false, false); // Don't requeue
      }
    }, { noAck: false });
  }

  async sendOrderRequest(orderData, timeoutMs = 30000) {
    if (!this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }

    const correlationId = this.generateCorrelationId();
    const message = JSON.stringify(orderData);

    console.log(`📤 Sending order request with correlationId: ${correlationId}`);

    // Create promise that will be resolved when response arrives
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(correlationId);
        reject(new Error(`Order request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.responseHandlers.set(correlationId, { resolve, reject, timeout });
    });

    // Send message to request queue
    this.channel.sendToQueue(ORDERS_REQUEST_QUEUE, Buffer.from(message), {
      persistent: true,
      correlationId,
      replyTo: ORDERS_RESPONSE_QUEUE,
      contentType: 'application/json'
    });

    return responsePromise;
  }

  generateCorrelationId() {
    return `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async disconnect() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.isConnected = false;
      console.log('✅ RabbitMQ disconnected');
    } catch (err) {
      console.error('❌ Error disconnecting from RabbitMQ:', err);
    }
  }
}

// Singleton instance
const messagingService = new MessagingService();

// Auto-connect on startup
messagingService.connect().catch(err => {
  console.error('Failed to initialize messaging service:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await messagingService.disconnect();
  process.exit(0);
});

module.exports = messagingService;
