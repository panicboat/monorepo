package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Types for User Service
type User struct {
	ID        int32     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type GetUserResponse struct {
	User *User `json:"user"`
}

type ListUsersResponse struct {
	Users         []*User `json:"users"`
	NextPageToken string  `json:"next_page_token"`
}

// Types for Product Service
type Product struct {
	ID          int32     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	Stock       int32     `json:"stock"`
	CreatedAt   time.Time `json:"created_at"`
}

type GetProductResponse struct {
	Product *Product `json:"product"`
}

type ListProductsResponse struct {
	Products      []*Product `json:"products"`
	NextPageToken string     `json:"next_page_token"`
}

// Types for Order Service
type OrderItem struct {
	ProductID int32   `json:"product_id"`
	Quantity  int32   `json:"quantity"`
	Price     float64 `json:"price"`
}

type Order struct {
	ID          int32       `json:"id"`
	UserID      int32       `json:"user_id"`
	Items       []OrderItem `json:"items"`
	TotalAmount float64     `json:"total_amount"`
	Status      string      `json:"status"`
	CreatedAt   time.Time   `json:"created_at"`
}

type GetOrderResponse struct {
	Order *Order `json:"order"`
}

type ListOrdersResponse struct {
	Orders        []*Order `json:"orders"`
	NextPageToken string   `json:"next_page_token"`
}

type CreateOrderRequest struct {
	UserID int32       `json:"user_id"`
	Items  []OrderItem `json:"items"`
}

type CreateOrderResponse struct {
	Order *Order `json:"order"`
}

// Gateway server
type GatewayServer struct {
	userServiceConn    *grpc.ClientConn
	productServiceConn *grpc.ClientConn
	orderServiceConn   *grpc.ClientConn
}

func NewGatewayServer() (*GatewayServer, error) {
	userServiceAddr := os.Getenv("USER_SERVICE_ADDRESS")
	productServiceAddr := os.Getenv("PRODUCT_SERVICE_ADDRESS")
	orderServiceAddr := os.Getenv("ORDER_SERVICE_ADDRESS")

	if userServiceAddr == "" {
		userServiceAddr = "localhost:50051"
	}
	if productServiceAddr == "" {
		productServiceAddr = "localhost:50052"
	}
	if orderServiceAddr == "" {
		orderServiceAddr = "localhost:50053"
	}

	// Connect to User Service
	userConn, err := grpc.Dial(userServiceAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to user service: %v", err)
	}

	// Connect to Product Service
	productConn, err := grpc.Dial(productServiceAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		userConn.Close()
		return nil, fmt.Errorf("failed to connect to product service: %v", err)
	}

	// Connect to Order Service
	orderConn, err := grpc.Dial(orderServiceAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		userConn.Close()
		productConn.Close()
		return nil, fmt.Errorf("failed to connect to order service: %v", err)
	}

	return &GatewayServer{
		userServiceConn:    userConn,
		productServiceConn: productConn,
		orderServiceConn:   orderConn,
	}, nil
}

func (s *GatewayServer) Close() {
	s.userServiceConn.Close()
	s.productServiceConn.Close()
	s.orderServiceConn.Close()
}

// CORS middleware
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// User Service handlers
func (s *GatewayServer) handleGetUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from URL path
	idStr := r.URL.Path[len("/api/v1/users/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Mock response for demonstration
	user := &User{
		ID:        int32(id),
		Name:      fmt.Sprintf("User %d", id),
		Email:     fmt.Sprintf("user%d@example.com", id),
		CreatedAt: time.Now(),
	}

	response := &GetUserResponse{User: user}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *GatewayServer) handleListUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Mock response for demonstration
	users := []*User{
		{ID: 1, Name: "John Doe", Email: "john@example.com", CreatedAt: time.Now()},
		{ID: 2, Name: "Jane Smith", Email: "jane@example.com", CreatedAt: time.Now()},
		{ID: 3, Name: "Alice Johnson", Email: "alice@example.com", CreatedAt: time.Now()},
	}

	response := &ListUsersResponse{
		Users:         users,
		NextPageToken: "",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Product Service handlers
func (s *GatewayServer) handleGetProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from URL path
	idStr := r.URL.Path[len("/api/v1/products/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid product ID", http.StatusBadRequest)
		return
	}

	// Mock response for demonstration
	product := &Product{
		ID:          int32(id),
		Name:        fmt.Sprintf("Product %d", id),
		Description: fmt.Sprintf("Description for product %d", id),
		Price:       99.99,
		Stock:       10,
		CreatedAt:   time.Now(),
	}

	response := &GetProductResponse{Product: product}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *GatewayServer) handleListProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Mock response for demonstration
	products := []*Product{
		{ID: 1, Name: "Laptop", Description: "High-performance laptop", Price: 999.99, Stock: 10, CreatedAt: time.Now()},
		{ID: 2, Name: "Mouse", Description: "Wireless optical mouse", Price: 29.99, Stock: 50, CreatedAt: time.Now()},
		{ID: 3, Name: "Keyboard", Description: "Mechanical keyboard", Price: 89.99, Stock: 25, CreatedAt: time.Now()},
	}

	response := &ListProductsResponse{
		Products:      products,
		NextPageToken: "",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Order Service handlers
func (s *GatewayServer) handleGetOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract order ID from URL path
	idStr := r.URL.Path[len("/api/v1/orders/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	// Mock response for demonstration
	order := &Order{
		ID:     int32(id),
		UserID: 1,
		Items: []OrderItem{
			{ProductID: 1, Quantity: 1, Price: 999.99},
			{ProductID: 2, Quantity: 1, Price: 29.99},
		},
		TotalAmount: 1029.98,
		Status:      "completed",
		CreatedAt:   time.Now(),
	}

	response := &GetOrderResponse{Order: order}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *GatewayServer) handleListOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Mock response for demonstration
	orders := []*Order{
		{
			ID:     1,
			UserID: 1,
			Items: []OrderItem{
				{ProductID: 1, Quantity: 1, Price: 999.99},
				{ProductID: 2, Quantity: 1, Price: 29.99},
			},
			TotalAmount: 1029.98,
			Status:      "completed",
			CreatedAt:   time.Now(),
		},
		{
			ID:     2,
			UserID: 2,
			Items: []OrderItem{
				{ProductID: 2, Quantity: 1, Price: 29.99},
			},
			TotalAmount: 29.99,
			Status:      "pending",
			CreatedAt:   time.Now(),
		},
	}

	response := &ListOrdersResponse{
		Orders:        orders,
		NextPageToken: "",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *GatewayServer) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Calculate total amount
	totalAmount := 0.0
	for _, item := range req.Items {
		totalAmount += item.Price * float64(item.Quantity)
	}

	// Mock response for demonstration
	order := &Order{
		ID:          1,
		UserID:      req.UserID,
		Items:       req.Items,
		TotalAmount: totalAmount,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}

	response := &CreateOrderResponse{Order: order}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Setup routes
func (s *GatewayServer) setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	// User Service routes
	mux.HandleFunc("/api/v1/users", s.handleListUsers)
	mux.HandleFunc("/api/v1/users/", s.handleGetUser)

	// Product Service routes
	mux.HandleFunc("/api/v1/products", s.handleListProducts)
	mux.HandleFunc("/api/v1/products/", s.handleGetProduct)

	// Order Service routes
	mux.HandleFunc("/api/v1/orders", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			s.handleListOrders(w, r)
		} else if r.Method == "POST" {
			s.handleCreateOrder(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/orders/", s.handleGetOrder)

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	return mux
}

func main() {
	// Create gateway server
	gateway, err := NewGatewayServer()
	if err != nil {
		log.Fatalf("Failed to create gateway server: %v", err)
	}
	defer gateway.Close()

	// Setup routes
	mux := gateway.setupRoutes()

	// Add CORS middleware
	handler := enableCORS(mux)

	// Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}

	log.Printf("gRPC Gateway listening on :%s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}