import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Types
interface OrderItem {
  product_id: number;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  user_id: number;
  items: OrderItem[];
  total_amount: number;
  status: string;
  created_at: Date;
}

interface GetOrderRequest {
  id: number;
}

interface GetOrderResponse {
  order: Order;
}

interface ListOrdersRequest {
  user_id: number;
  page_size: number;
  page_token: string;
}

interface ListOrdersResponse {
  orders: Order[];
  next_page_token: string;
}

interface CreateOrderRequest {
  user_id: number;
  items: OrderItem[];
}

interface CreateOrderResponse {
  order: Order;
}

// Order Service Implementation
class OrderService {
  private db: Client;

  constructor(dbClient: Client) {
    this.db = dbClient;
  }

  async getOrder(call: any, callback: any): Promise<void> {
    try {
      const request: GetOrderRequest = call.request;
      
      // Get order
      const orderResult = await this.db.query(
        'SELECT id, user_id, total_amount, status, created_at FROM orders WHERE id = $1',
        [request.id]
      );

      if (orderResult.rows.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Order not found'
        });
      }

      const orderRow = orderResult.rows[0];

      // Get order items
      const itemsResult = await this.db.query(
        'SELECT product_id, quantity, price FROM order_items WHERE order_id = $1',
        [request.id]
      );

      const order: Order = {
        id: orderRow.id,
        user_id: orderRow.user_id,
        items: itemsResult.rows.map(row => ({
          product_id: row.product_id,
          quantity: row.quantity,
          price: parseFloat(row.price)
        })),
        total_amount: parseFloat(orderRow.total_amount),
        status: orderRow.status,
        created_at: orderRow.created_at
      };

      const response: GetOrderResponse = { order };
      callback(null, response);
    } catch (error) {
      console.error('Error getting order:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }

  async listOrders(call: any, callback: any): Promise<void> {
    try {
      const request: ListOrdersRequest = call.request;
      const pageSize = request.page_size || 10;
      const offset = request.page_token ? parseInt(request.page_token) : 0;

      // Get orders with pagination
      const ordersResult = await this.db.query(
        'SELECT id, user_id, total_amount, status, created_at FROM orders WHERE user_id = $1 ORDER BY id LIMIT $2 OFFSET $3',
        [request.user_id, pageSize + 1, offset]
      );

      const orders: Order[] = [];
      
      for (const orderRow of ordersResult.rows.slice(0, pageSize)) {
        // Get items for each order
        const itemsResult = await this.db.query(
          'SELECT product_id, quantity, price FROM order_items WHERE order_id = $1',
          [orderRow.id]
        );

        const order: Order = {
          id: orderRow.id,
          user_id: orderRow.user_id,
          items: itemsResult.rows.map(row => ({
            product_id: row.product_id,
            quantity: row.quantity,
            price: parseFloat(row.price)
          })),
          total_amount: parseFloat(orderRow.total_amount),
          status: orderRow.status,
          created_at: orderRow.created_at
        };

        orders.push(order);
      }

      let nextPageToken = '';
      if (ordersResult.rows.length > pageSize) {
        nextPageToken = (offset + pageSize).toString();
      }

      const response: ListOrdersResponse = {
        orders,
        next_page_token: nextPageToken
      };

      callback(null, response);
    } catch (error) {
      console.error('Error listing orders:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }

  async createOrder(call: any, callback: any): Promise<void> {
    try {
      const request: CreateOrderRequest = call.request;
      
      // Calculate total amount
      const totalAmount = request.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Start transaction
      await this.db.query('BEGIN');

      try {
        // Insert order
        const orderResult = await this.db.query(
          'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id, created_at',
          [request.user_id, totalAmount, 'pending']
        );

        const orderId = orderResult.rows[0].id;
        const createdAt = orderResult.rows[0].created_at;

        // Insert order items
        for (const item of request.items) {
          await this.db.query(
            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
            [orderId, item.product_id, item.quantity, item.price]
          );
        }

        await this.db.query('COMMIT');

        const order: Order = {
          id: orderId,
          user_id: request.user_id,
          items: request.items,
          total_amount: totalAmount,
          status: 'pending',
          created_at: createdAt
        };

        const response: CreateOrderResponse = { order };
        callback(null, response);
      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error creating order:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
}

// Database connection
async function createDatabaseConnection(): Promise<Client> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'order_admin',
    password: process.env.DB_PASSWORD || 'order_password',
    database: process.env.DB_NAME || 'order_db',
  });

  await client.connect();
  console.log('Connected to database successfully');
  return client;
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to database
    const dbClient = await createDatabaseConnection();

    // Create gRPC server
    const server = new grpc.Server();
    const orderService = new OrderService(dbClient);

    // Define service methods
    const serviceImplementation = {
      GetOrder: orderService.getOrder.bind(orderService),
      ListOrders: orderService.listOrders.bind(orderService),
      CreateOrder: orderService.createOrder.bind(orderService),
    };

    // Add service to server
    server.addService(
      {
        GetOrder: {
          path: '/order.v1.OrderService/GetOrder',
          requestStream: false,
          responseStream: false,
          requestSerialize: (req: any) => Buffer.from(JSON.stringify(req)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (res: any) => Buffer.from(JSON.stringify(res)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
        },
        ListOrders: {
          path: '/order.v1.OrderService/ListOrders',
          requestStream: false,
          responseStream: false,
          requestSerialize: (req: any) => Buffer.from(JSON.stringify(req)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (res: any) => Buffer.from(JSON.stringify(res)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
        },
        CreateOrder: {
          path: '/order.v1.OrderService/CreateOrder',
          requestStream: false,
          responseStream: false,
          requestSerialize: (req: any) => Buffer.from(JSON.stringify(req)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (res: any) => Buffer.from(JSON.stringify(res)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
        },
      },
      serviceImplementation
    );

    // Start server
    const bindAddress = '0.0.0.0:50053';
    server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) {
        console.error('Failed to bind server:', error);
        return;
      }
      
      console.log(`Order service listening on ${bindAddress}`);
      server.start();
    });

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();