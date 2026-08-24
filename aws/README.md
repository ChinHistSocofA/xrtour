## AWS Deployment Templates

### Prerequisites

- AWS Account
- AWS CLI configured
- Registered domain name with access to DNS configuration

### Common Templates

- Cloudfront / S3
- SES

### Basic Deployment

- VPC with Elastic IP
- Single EC2 application server instance
- Single RDS database instance

#### Setup

1. Name your deployment (i.e. "xrtour") and its configuration as an environment (i.e. "dev", "staging", "production", etc).

2. Copy the `example.env` file based on your environment name, i.e `.env.production` and fill in blank values. Variables include:

   a. DOMAIN: the domain name you've registered, i.e. `xrtour.org` or `xrtour.mynonprofit.org`

   b. IMAGE_URI: the name of the server image, i.e. `chinhistsocofa/xrtour:1.0.59`  
    See latest versions at: https://hub.docker.com/repository/docker/chinhistsocofa/xrtour/general

   c. LETSENCRYPT_EMAIL: the email address to use when requesting free SSL certificates from Let's Encrypt. Should be the email address of an administrator.

   d. MIXPANEL_TOKEN: an API token from a Mixpanel account for analytics. Sign up for a free Mixpanel account at: https://mixpanel.com

   e. SESSION_SECRET: a secret key used to sign session cookies. Can be generated using the script in `server/bin/generate-session-secret`

   f. VITE_FEATURE_ASSET_TYPES: a list of the asset types allowed to be used in creating tours. It should be a comma separated list with NO spaces from the following options:

   - 3D_MODEL: glb 3D models
   - AR_LINK: links to externally hosted AR experiences
   - AUDIO: audio files
   - IMAGE: images
   - IMAGE_OVERLAY: images that can be overlayed over a live camera (with optional fallback image)
   - IMAGE_SPHERE: 360 degree panoramic images

   g. VITE_FEATURE_REGISTRATION: set to `true` to allow users to register accounts for the application. If `false`, only invited users can create accounts.

   h. VITE_FEATURE_TRANSITIONS: set to `true` to enable the ability to create reusable transitions between stops in tours. For example, to describe a walking path between two locations.

   i. VITE_GOOGLE_WEBFONTS_API_KEY: the API key for Google Fonts. See https://developers.google.com/fonts/docs/developer_api

   j. VITE_MAPBOX_ACCESS_TOKEN: the access token for Mapbox. See https://www.mapbox.com/help/how-mapbox-access-tokens-work/

   k. VITE_SITE_TITLE: the name of the site.

3. After logging in to your AWS account in the AWS CLI (i.e. `aws login`), run the `./basic.sh` script and follow the prompts, entering your deployment name and environment. Follow the instructions to add DNS records to your domain as prompted.

4. Once complete, log in to the new server following the prompts. You can become the superuser by running `sudo su`.

5. To allow LetsEncrypt to validate wildcard SSL certs, you'll need to configure a "solver" for your DNS host. See the Configuration section at: https://github.com/dokku/dokku-letsencrypt

   For example, to configure CloudFlare:

   ```
   dokku letsencrypt:set xrtour dns-provider cloudflare
   dokku letsencrypt:set xrtour dns-provider-CF_DNS_API_TOKEN <your-cf-dns-api-token>
   ```

   Then, enable SSL:

   ```
   dokku letsencrypt:enable xrtour
   ```

6. Create a new admin user:

   ```
   dokku enter xrtour web
   cd server
   bin/create-admin Firstname Lastname email@address.com password
   ```
