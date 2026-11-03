import json, os, time, urllib.parse, urllib.request
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
           "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
os.makedirs("out", exist_ok=True)
log = []
for job in json.load(open("jobs.json")):
    ok = False
    for attempt in range(3):
        for url in SERVERS:
            t = time.time()
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": job["query"]}).encode(), method="POST",
                                             headers={"User-Agent": "Elyx demo map prefetch (contact: github.com/elyx-business)"})
                body = json.loads(urllib.request.urlopen(req, timeout=120).read().decode())
                n = len(body.get("elements", []))
                if n == 0 and "runtime error" in str(body.get("remark", "")):
                    raise ValueError("runtime error " + body["remark"][:100])
                json.dump(body, open(f"out/{job['id']}.json", "w"), ensure_ascii=False)
                log.append(f"{job['id']}: {url} {n} elements {time.time() - t:.1f}s")
                ok = True
                break
            except Exception as e:
                log.append(f"{job['id']}: {url} FAIL {type(e).__name__} {str(e)[:120]} {time.time() - t:.1f}s")
            time.sleep(3)
        if ok:
            break
        time.sleep(20)
open("out/log.txt", "w").write("\n".join(log))
print("\n".join(log))
