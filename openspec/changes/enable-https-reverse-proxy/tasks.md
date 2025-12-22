## 1. Implementation
- [ ] 1.1 Create TLS Secret (Self-signed for dev) in `services/reverse-proxy`
- [ ] 1.2 Update Nginx configuration (`server.conf`) to listen on 443 and use SSL
- [ ] 1.3 Update `deployment.yaml` to mount TLS Secret
- [ ] 1.4 Update `service.yaml` to expose port 443
- [ ] 1.5 Verify HTTPS connectivity using `curl -k` (for self-signed)
