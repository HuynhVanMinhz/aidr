from pathlib import Path
p = Path("/opt/aidr/docker-compose.prod.yml")
t = p.read_text(encoding="utf-8")
reps = [
    ('Keycloak__Authority: "https://${DOMAIN}/auth/realms/aidr"',
     'Keycloak__Authority: "http://${DOMAIN}/auth/realms/aidr"'),
    ('Keycloak__RequireHttpsMetadata: "true"',
     'Keycloak__RequireHttpsMetadata: "false"'),
    ('Keycloak__BaseUrl: "https://${DOMAIN}/auth"',
     'Keycloak__BaseUrl: "http://${DOMAIN}/auth"'),
    ('Cors__Origins__0: "https://${DOMAIN}"',
     'Cors__Origins__0: "http://${DOMAIN}"'),
    ('Cors__Origins__1: "https://www.${DOMAIN}"',
     'Cors__Origins__1: "http://www.${DOMAIN}"'),
    ('Auth__FrontendResetPasswordUrl: "https://${DOMAIN}/reset-password"',
     'Auth__FrontendResetPasswordUrl: "http://${DOMAIN}/reset-password"'),
]
for a, b in reps:
    t = t.replace(a, b)
p.write_text(t, encoding="utf-8")
print("patched ok")
