## AWS Deployment Templates

### Prerequisites

- AWS Account
- AWS CLI configured
- Registered domain name with access to DNS

### Common Templates

- Cloudfront / S3
- SES

### Basic Deployment

- VPC with Elastic IP
- Single EC2 application server instance
- Single RDS database instance

#### Configuring LetsEncrypt DNS Solvers

To allow LetsEncrypt to validate wildcard SSL certs, you'll need to configure a "solver" for your DNS host. See the Configuration section at: https://github.com/dokku/dokku-letsencrypt

For example, to configure CloudFlare:

dokku letsencrypt:set --global dns-provider cloudflare
dokku letsencrypt:set --global dns-provider-CF_API_EMAIL <your-cf-email>
dokku letsencrypt:set --global dns-provider-CF_DNS_API_TOKEN <your-cf-dns-api-token>
dokku letsencrypt:set --global dns-provider-CF_ZONE_API_TOKEN <your-cf-zone-api-token>
