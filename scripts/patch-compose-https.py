from pathlib import Path
p = Path("/opt/aidr/docker-compose.prod.yml")
t = p.read_text(encoding="utf-8")
reps = [
    ('Keycloak__Authority: "http://${DOMAIN}/auth/realms/aidr"',
     'Keycloak__Authority: "https://${DOMAIN}/auth/realms/aidr"'),
    ('Keycloak__RequireHttpsMetadata: "false"',
     'Keycloak__RequireHttpsMetadata: "true"'),
    ('Keycloak__BaseUrl: "http://${DOMAIN}/auth"',
     'Keycloak__BaseUrl: "https://${DOMAIN}/auth"'),
    ('Cors__Origins__0: "http://${DOMAIN}"',
     'Cors__Origins__0: "https://${DOMAIN}"'),
    ('Cors__Origins__1: "http://www.${DOMAIN}"',
     'Cors__Origins__1: "https://www.${DOMAIN}"'),
    ('Auth__FrontendResetPasswordUrl: "http://${DOMAIN}/reset-password"',
     'Auth__FrontendResetPasswordUrl: "https://${DOMAIN}/reset-password"'),
    ("./infra/nginx/nginx.prod.http-only.conf:/etc/nginx/nginx.conf:ro",
     "./infra/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro"),
]
for a, b in reps:
    t = t.replace(a, b)
p.write_text(t, encoding="utf-8")
print("https patched ok")
