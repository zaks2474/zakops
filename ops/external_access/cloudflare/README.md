# Cloudflare Zero Trust Configuration

This directory contains configuration for exposing ZakOps Agent API via Cloudflare Tunnel
with Zero Trust access policies.

## Overview

Cloudflare Tunnel (cloudflared) provides secure, outbound-only connections from your
infrastructure to Cloudflare's edge, eliminating the need to open inbound ports.

## Prerequisites

1. Cloudflare account with Zero Trust enabled
2. `cloudflared` installed on the server
3. Domain configured in Cloudflare DNS

## Setup Steps

### 1. Install cloudflared

```bash
# Debian/Ubuntu
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Or via package manager
# See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### 2. Authenticate cloudflared

```bash
cloudflared tunnel login
```

This opens a browser for authentication and creates credentials at
`~/.cloudflared/cert.pem`.

### 3. Create the Tunnel

```bash
# Create tunnel (generates credentials file)
cloudflared tunnel create zakops-agent

# Note the tunnel ID from output
```

### 4. Configure DNS

```bash
# Route traffic to tunnel
cloudflared tunnel route dns zakops-agent agent.yourdomain.com
```

### 5. Deploy Configuration

Copy the configuration template:

```bash
cp cloudflared_config.yml ~/.cloudflared/config.yml
```

Edit to set your tunnel ID and credentials path.

### 6. Run as Service

```bash
# Install as systemd service
sudo cloudflared service install

# Start the service
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

## Access Policies

Access policies are defined in `access_policies.yaml` and should be configured
in the Cloudflare Zero Trust dashboard:

1. Go to Zero Trust Dashboard > Access > Applications
2. Create application for your domain
3. Add access policies as defined in `access_policies.yaml`

## Security Considerations

1. **Principle of Least Privilege**: Only expose necessary endpoints
2. **Rate Limiting**: Configure Cloudflare WAF rate limiting rules
3. **IP Access Lists**: Restrict to known IPs where possible
4. **mTLS**: Consider client certificates for machine-to-machine auth
5. **Logging**: Enable Cloudflare Access logs for audit trail

## Configuration Files

- `cloudflared_config.yml` - Tunnel configuration template
- `access_policies.yaml` - Zero Trust access policies

## Troubleshooting

### Check tunnel status

```bash
cloudflared tunnel info zakops-agent
```

### View logs

```bash
journalctl -u cloudflared -f
```

### Test connectivity

```bash
curl -I https://agent.yourdomain.com/v1/health
```

## Environment Variables

For production, sensitive values should come from environment variables:

- `CLOUDFLARE_TUNNEL_ID` - Tunnel UUID
- `CLOUDFLARE_TUNNEL_TOKEN` - Tunnel token (alternative to credentials file)

## Maintenance

### Rotate credentials

```bash
cloudflared tunnel token zakops-agent
```

### Update cloudflared

```bash
sudo apt update && sudo apt upgrade cloudflared
```

## References

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Zero Trust Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [WAF Rules](https://developers.cloudflare.com/waf/)
