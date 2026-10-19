/* Course content: levels and topics. Bodies are small HTML strings. */
(function () {
  const BP = window.BP;

  BP.LEVELS = [
    { n: 1, title: 'Foundations', blurb: 'How a request travels, how fast things are, how to grow' },
    { n: 2, title: 'Building Blocks', blurb: 'Load balancers, caches, CDNs, databases, queues' },
    { n: 3, title: 'Data at Scale', blurb: 'Copying, splitting and agreeing on data' },
    { n: 4, title: 'Distributed Systems', blurb: 'Staying correct and alive when things fail' },
    { n: 5, title: 'Architecture at Scale', blurb: 'Microservices, events, feeds, monitoring, security' },
  ];

  BP.TOPICS = [
    /* =================== LEVEL 1 =================== */
    {
      id: 'what-is-system-design', level: 1, mins: 6, title: 'What is system design?',
      short: 'The job, the vocabulary, and the questions you always ask first.',
      keywords: 'requirements functional non-functional scalability availability reliability',
      tldr: 'System design is deciding which parts a software system needs, how they talk, and where the data lives, so it keeps working when millions of people use it at once.',
      analogy: 'Designing a system is like planning a restaurant kitchen. One cook can serve ten guests. For ten thousand guests you need more cooks, stations, a pantry, someone taking orders, and a plan for when the fryer breaks. The recipes (your code) matter less than how the kitchen is laid out.',
      body: `
<h2>Two kinds of requirements</h2>
<p><strong>Functional requirements</strong> say what the system does: “users can order food”, “drivers see nearby rides”. <strong>Non-functional requirements</strong> say how well it does it: how fast, how many users, how often it may be down. Most design decisions come from the non-functional side.</p>
<h2>The words you will hear all the time</h2>
<ul>
<li><strong>Scalability:</strong> can it handle 10× more users by adding machines?</li>
<li><strong>Availability:</strong> what percent of the time does it answer? 99.9% means about 8.8 hours of downtime a year.</li>
<li><strong>Reliability:</strong> does it give the right answer and not lose data?</li>
<li><strong>Latency:</strong> how long one request takes. <strong>Throughput:</strong> how many requests per second it handles.</li>
<li><strong>Consistency:</strong> does everyone see the same data at the same time?</li>
<li><strong>Single point of failure (SPOF):</strong> one part whose crash takes everything down.</li>
</ul>
<h2>There is no perfect design</h2>
<p>Every choice trades something. A cache makes reads fast but may show old data. A second datacenter improves availability but costs money and adds sync problems. Good system design is naming the trade-off out loud and picking the side that fits the product. Paying money? Pick correctness. Showing a like count? Pick speed.</p>
<h2>How to use this site</h2>
<p>Go level by level. Play with every simulation until you can predict what will happen before you press the button. Then open a case study and try to sketch the design yourself before reading it.</p>`,
      takeaways: ['Start every design by writing functional and non-functional requirements.', 'Non-functional needs (scale, latency, availability) drive the architecture.', 'Every component is a trade-off. Say what you gain and what you give up.'],
      tip: 'Interviewers do not want a perfect diagram. They want to hear you ask clarifying questions, state assumptions with numbers, and explain why you chose each part.',
      seen: ['url-shortener', 'swiggy'],
      quiz: [
        { q: '“The app must load the menu in under 200 ms” is a…', o: ['Functional requirement', 'Non-functional requirement', 'Database schema', 'API endpoint'], a: 1, why: 'It describes how well the system performs, not what feature it offers.' },
        { q: 'A single database server that every request depends on is a…', o: ['Cache', 'Load balancer', 'Single point of failure', 'Shard'], a: 2, why: 'If it dies, everything dies. Replication removes this.' },
      ],
    },
    {
      id: 'client-server', level: 1, mins: 9, title: 'How a request travels', sim: 'requestFlow',
      short: 'DNS, TCP, TLS, HTTP. What happens when you tap “Order”.',
      keywords: 'dns http https tcp tls ip client server request response',
      tldr: 'Your phone (the client) finds the server’s address with DNS, opens a secure connection, sends an HTTP request, and the server answers, often after asking a database.',
      analogy: 'Calling a restaurant. You look up the number in your contacts (DNS), the phone rings and someone picks up (TCP handshake), you both confirm it is really them (TLS), you place the order (HTTP request), and they read back your order (response).',
      simIntro: 'Send a request with nothing cached. Then cache the DNS answer and reuse the connection. Watch the total drop.',
      body: `
<h2>The pieces</h2>
<ul>
<li><strong>Client:</strong> the app or browser that asks.</li>
<li><strong>DNS:</strong> the internet’s phone book. Turns <code>api.swiggy.com</code> into an IP address like <code>13.235.12.4</code>. Answers are cached for a time called the TTL.</li>
<li><strong>TCP:</strong> a reliable pipe between two machines. Opening one costs a round trip.</li>
<li><strong>TLS:</strong> encryption on top (the S in HTTPS). TLS 1.3 adds one more round trip on a new connection.</li>
<li><strong>HTTP:</strong> the language of the request. A method (<code>GET</code>, <code>POST</code>), a path, headers and a body.</li>
<li><strong>Server:</strong> runs your code, usually talks to a database, and returns a status code (<code>200 OK</code>, <code>404 Not Found</code>, <code>500 Server Error</code>).</li>
</ul>
<h2>Why this matters for design</h2>
<p>A round trip from India to a US server takes ~200 ms. A new HTTPS connection needs two of them before any data moves. That is why apps reuse connections (keep-alive, HTTP/2), why DNS answers are cached, and why big companies put servers close to users. Many “make it faster” answers in interviews come down to removing round trips.</p>
<h2>Stateless servers</h2>
<p>If the server keeps nothing about you in its own memory between requests, any server can handle your next request. That single property is what lets you add more servers later. Session data goes to a shared store (like Redis) or into a signed token.</p>`,
      takeaways: ['DNS → TCP → TLS → HTTP request → server work → response.', 'Each round trip costs real time. Caching DNS and reusing connections removes them.', 'Stateless servers can be swapped and multiplied freely.'],
      tip: 'If asked “what happens when you type a URL”, walk through DNS, TCP, TLS, HTTP, server, database, response, and rendering. Mention caching at each layer.',
      seen: ['swiggy', 'url-shortener'],
      quiz: [
        { q: 'What does DNS do?', o: ['Encrypts traffic', 'Turns a domain name into an IP address', 'Balances load', 'Stores sessions'], a: 1, why: 'DNS is the lookup from name to address. Its answers are cached using a TTL.' },
        { q: 'Why make servers stateless?', o: ['They use less CPU', 'Any server can handle any request, so you can add or remove servers freely', 'It removes the need for a database', 'It makes TLS faster'], a: 1, why: 'State lives in shared stores, so servers become interchangeable.' },
      ],
    },
    {
      id: 'latency', level: 1, mins: 7, title: 'Latency, throughput and the numbers', sim: 'latency',
      short: 'Memory is fast, disk is slow, the ocean is very slow. Percentiles and nines.',
      keywords: 'latency throughput p99 percentile availability nines sla',
      tldr: 'Latency is how long one request takes. Throughput is how many you handle per second. Knowing rough speeds of memory, SSD, network and disk lets you guess where time goes.',
      analogy: 'A highway. Latency is how long one car takes to drive from A to B. Throughput is how many cars pass per hour. Adding lanes raises throughput but doesn’t make any single car faster.',
      body: `
<h2>Average lies. Use percentiles</h2>
<p>If 99 requests take 50 ms and one takes 5 seconds, the average looks fine but that one user is furious. Teams track <strong>p50</strong> (median), <strong>p95</strong> and <strong>p99</strong> (the slowest 1%). A page that makes 50 backend calls hits the p99 of at least one of them on most loads, so tail latency matters a lot.</p>
<h2>Availability in nines</h2>
<div class="table-wrap"><table><tr><th>Availability</th><th>Down per year</th><th>Down per month</th></tr>
<tr><td class="num">99%</td><td class="num">3.65 days</td><td class="num">7.3 hours</td></tr>
<tr><td class="num">99.9%</td><td class="num">8.76 hours</td><td class="num">43.8 min</td></tr>
<tr><td class="num">99.99%</td><td class="num">52.6 min</td><td class="num">4.4 min</td></tr>
<tr><td class="num">99.999%</td><td class="num">5.3 min</td><td class="num">26 s</td></tr></table></div>
<p>Parts in a chain multiply: two services at 99.9% each, both needed, give about 99.8%. Parts in parallel (replicas) add up: two independent replicas at 99% give 99.99%.</p>
<h2>Rules of thumb from the numbers</h2>
<ul><li>Memory is ~100× faster than SSD and ~100,000× faster than a cross-world round trip. That is why caches exist.</li>
<li>Reading sequentially is far faster than random reads. That is why logs and Kafka append to the end of files.</li>
<li>Within one datacenter a round trip is ~0.5 ms. Across continents it is 150–250 ms. Put data near users.</li></ul>`,
      takeaways: ['Measure p99, not just the average.', 'Each extra nine of availability is ~10× harder and costlier.', 'Memory ≫ SSD ≫ disk ≫ wide network. Design to stay on the fast side.'],
      tip: 'Quote rough numbers with confidence: “a Redis read is under a millisecond, a cross-region call is ~150 ms, so we keep this on the hot path in-region.”',
      seen: ['netflix', 'hotstar'],
      quiz: [
        { q: 'Your p50 is 40 ms and p99 is 2 s. What does that tell you?', o: ['Everything is fast', '1% of requests are very slow and need investigating', 'The average is 2 s', 'The server is down'], a: 1, why: 'The tail is long. Those slow requests often come from GC pauses, slow queries or a sick dependency.' },
        { q: '99.99% availability allows roughly how much downtime per year?', o: ['5 minutes', '52 minutes', '8.7 hours', '3.6 days'], a: 1, why: 'Four nines ≈ 52.6 minutes per year.' },
      ],
    },
    {
      id: 'scaling', level: 1, mins: 7, title: 'Scale up vs scale out', sim: 'scaling',
      short: 'Bigger machine or more machines? Why the industry picks “more”.',
      keywords: 'vertical horizontal scaling stateless spof autoscaling',
      tldr: 'Vertical scaling buys a bigger machine. Horizontal scaling adds more machines behind a load balancer. Big systems scale out because there is no infinitely big machine, and one machine is one point of failure.',
      analogy: 'A busy dhaba. Vertical: replace the cook with a faster, pricier one. Horizontal: hire four normal cooks. The four cooks cost less, and if one goes home sick the kitchen still runs.',
      simIntro: 'Push traffic to 20K req/s in both modes. Compare the price. Then crash a server in each mode.',
      body: `
<h2>Vertical scaling (scale up)</h2>
<p>Move to a machine with more CPU, RAM and faster disks. No code changes. Great first step and often right for databases early on. Limits: price grows faster than power, there is a ceiling, and it is still one machine.</p>
<h2>Horizontal scaling (scale out)</h2>
<p>Run many copies of your app behind a load balancer. Add copies when busy, remove them at night (autoscaling). This needs a <strong>stateless</strong> app: no user session stored in local memory, no files saved on local disk.</p>
<h2>The usual order</h2>
<ol><li>One server running app and database.</li><li>Move the database to its own machine.</li><li>Many app servers behind a load balancer.</li><li>Cache and read replicas for the database.</li><li>Shard the database when writes outgrow one machine.</li></ol>
<p>The <a href="#scale">1 → 100M users story</a> walks through each step with a diagram.</p>`,
      pros: ['Horizontal: near-unlimited growth', 'Horizontal: survives single machine failures', 'Vertical: zero code changes, simple to run'],
      cons: ['Horizontal: app must be stateless, more moving parts', 'Vertical: hard ceiling and steep prices', 'Vertical: still a single point of failure'],
      prosLabel: 'Benefits', consLabel: 'Costs',
      takeaways: ['Scale up first when it is cheap and simple. Scale out when you must.', 'Statelessness is the ticket to horizontal scaling.', 'Databases are the hardest part to scale out. That is Level 3.'],
      tip: 'Say “I’ll keep the app tier stateless so we can scale it horizontally behind a load balancer, and store sessions in Redis.” It shows you know why.',
      seen: ['hotstar', 'swiggy'],
      quiz: [
        { q: 'What must be true for an app to scale horizontally?', o: ['It must be written in Go', 'It must be stateless, or keep state in shared stores', 'It must use NoSQL', 'It must run on one machine'], a: 1, why: 'If a server holds user state in memory, the next request may hit a different server that doesn’t have it.' },
        { q: 'Which is a real downside of vertical scaling?', o: ['Requires a load balancer', 'There is a maximum machine size', 'Needs code changes', 'Cannot run databases'], a: 1, why: 'You eventually hit the biggest machine money can buy.' },
      ],
    },
    {
      id: 'estimation', level: 1, mins: 8, title: 'Back-of-envelope estimation',
      short: 'Turn “10M users” into QPS, storage and bandwidth in two minutes.',
      keywords: 'estimate qps storage bandwidth capacity planning math',
      tldr: 'Quick math with round numbers tells you whether you need 1 server or 1,000, and whether data fits on one disk. The goal is the right order of magnitude, not exact numbers.',
      analogy: 'Planning food for a wedding. You don’t count grains of rice. 500 guests × 2 plates × 300 g ≈ 300 kg. Good enough to call the caterer.',
      body: `
<h2>The four numbers to memorise</h2>
<ul>
<li>1 day = 86,400 s ≈ <strong>100,000 s</strong> (10⁵). So 1M requests a day ≈ 12 per second.</li>
<li>Peak traffic ≈ <strong>2–3× average</strong> (dinner time, match finals: much more).</li>
<li>1 KB × 1M = 1 GB. 1 MB × 1M = 1 TB.</li>
<li>A typical app server handles <strong>~1,000–10,000</strong> simple requests/s. A tuned Redis node does ~100K ops/s.</li>
</ul>
<h2>The recipe</h2>
<div class="calc">
writes/s = DAU × writes per user per day ÷ 86,400<br>
reads/s  = writes/s × read:write ratio<br>
peak     = average × 2 to 3<br>
storage  = writes per day × bytes per item × days kept<br>
bandwidth = requests/s × response size
</div>
<h2>Worked example: a food delivery app</h2>
<div class="calc">
DAU 20M, each places 0.5 orders/day → 10M orders/day<br>
orders/s = 10M ÷ 10⁵ ≈ <span class="r">100/s</span>, dinner peak ≈ <span class="r">300/s</span><br>
menu views: 20 per order → <span class="r">2,000 reads/s</span>, peak <span class="r">6,000/s</span><br>
order row 2 KB × 10M/day = 20 GB/day → <span class="r">~7 TB/year</span>
</div>
<p>Conclusion: writes are modest (one good database can take it), reads are heavy (cache menus), storage grows steadily (archive old orders). That is a design direction from 2 minutes of math.</p>
<p>Try your own numbers in the <a href="#estimate">estimator</a>.</p>`,
      takeaways: ['Round hard: 86,400 → 10⁵.', 'Always compute peak, not just average.', 'Use the numbers to make a decision: “reads dominate, so cache”.'],
      tip: 'Say your assumptions out loud, write them down, and keep the math to one or two lines. Then say what the numbers imply for the design.',
      seen: ['url-shortener', 'whatsapp', 'instagram'],
      quiz: [
        { q: '50M requests per day is roughly how many per second on average?', o: ['50', '500', '5,000', '50,000'], a: 1, why: '50M ÷ 100K ≈ 500/s. Peak would be ~1,000–1,500/s.' },
        { q: '1M new users per day, each storing a 100 KB profile photo. Storage per year?', o: ['~36 GB', '~3.6 TB', '~36 TB', '~360 TB'], a: 2, why: '100 KB × 1M = 100 GB/day × 365 ≈ 36.5 TB.' },
      ],
    },

    /* =================== LEVEL 2 =================== */
    {
      id: 'load-balancing', level: 2, mins: 9, title: 'Load balancers', sim: 'loadBalancer',
      short: 'Spread traffic over servers, skip dead ones. Algorithms and L4 vs L7.',
      keywords: 'load balancer round robin least connections ip hash health check l4 l7 nginx',
      tldr: 'A load balancer sits in front of your servers, gives each request to one of them, and stops sending traffic to servers that fail health checks.',
      analogy: 'The host at a busy restaurant. Guests don’t pick a table. The host looks at which waiters are free and seats them, and skips the waiter who just went on break.',
      simIntro: 'Big dots are heavy requests. Watch round robin overload a server, then switch to least connections. Crash a server mid-traffic. Try IP hash and notice each color sticks to one server.',
      body: `
<h2>What it does</h2>
<ul><li><strong>Distributes</strong> requests so no server is overloaded.</li>
<li><strong>Health checks</strong> every few seconds (<code>GET /health</code>) and removes failing servers.</li>
<li><strong>Hides</strong> your servers behind one address, so you can add or remove them freely.</li>
<li>Often <strong>terminates TLS</strong>, so app servers don’t spend CPU on encryption.</li></ul>
<h2>Layer 4 vs Layer 7</h2>
<p><strong>L4</strong> balancers look only at IP and port. Very fast, can’t read the request. <strong>L7</strong> balancers read HTTP: they can route <code>/api/payments</code> to one pool and <code>/images</code> to another, add headers, and retry. Examples: AWS NLB (L4), AWS ALB, NGINX, Envoy, HAProxy (L7).</p>
<h2>Who balances the balancer?</h2>
<p>The load balancer itself must not be a single point of failure. Run two (active-passive with a floating IP, or active-active), and use DNS to spread users across regions.</p>
<h2>Sticky sessions</h2>
<p>Sending a user to the same server every time (IP hash or a cookie) helps if that server holds their session. But it makes load uneven and breaks when that server dies. Better: keep servers stateless and store sessions in Redis.</p>`,
      pros: ['Round robin: dead simple, fair counts', 'Least connections: handles slow/heavy requests well', 'IP hash: same user → same server'],
      cons: ['Round robin: ignores how busy each server is', 'Least connections: LB must track live connections', 'IP hash: uneven load, reshuffles when servers change'],
      prosLabel: 'Algorithm strengths', consLabel: 'Algorithm weaknesses',
      takeaways: ['LBs spread load and route around failures via health checks.', 'L7 can route by URL and header. L4 is faster but blind.', 'Run at least two LBs. Avoid sticky sessions; go stateless.'],
      tip: 'Draw the LB, then immediately say how you avoid it being a SPOF and what algorithm you’d pick. Least connections is a safe default for uneven requests.',
      seen: ['swiggy', 'hotstar', 'url-shortener'],
      quiz: [
        { q: 'Requests vary a lot in how long they take. Best algorithm?', o: ['Round robin', 'Least connections', 'IP hash', 'Alphabetical'], a: 1, why: 'It sends work to whoever is least busy right now, so slow requests don’t pile up on one server.' },
        { q: 'Routing /payments to one pool and /search to another needs a…', o: ['Layer 4 load balancer', 'Layer 7 load balancer', 'CDN', 'DNS record'], a: 1, why: 'Only L7 reads the HTTP path.' },
      ],
    },
    {
      id: 'caching', level: 2, mins: 11, title: 'Caching', sim: 'cache',
      short: 'Keep hot data in memory. Patterns, eviction and the hard part: invalidation.',
      keywords: 'cache redis memcached lru ttl cache aside write through eviction invalidation stampede',
      tldr: 'A cache stores copies of frequently used data in fast memory, so most requests skip the slow database. It is the single biggest performance win in most systems.',
      analogy: 'Keeping the most-ordered dishes’ ingredients on the counter instead of walking to the cold storage each time. Counter space is small, so you keep only what is used most.',
      simIntro: 'Turn on auto traffic. Popular dishes (biryani, dosa) come up often. See how a 3-slot cache still hits most of the time. Shrink it to 1 slot and watch the hit ratio crash.',
      body: `
<h2>Where caches live</h2>
<p>Browser cache → CDN → load balancer → app memory → a shared cache like <strong>Redis</strong> or <strong>Memcached</strong> → database’s own buffer cache. You usually design the shared cache layer.</p>
<h2>Write patterns</h2>
<ul>
<li><strong>Cache-aside (lazy loading):</strong> app checks cache; on miss, reads DB and fills the cache. Most common. Only caches what is used.</li>
<li><strong>Write-through:</strong> every write goes to cache and DB together. Cache is always fresh, writes are slower.</li>
<li><strong>Write-back (write-behind):</strong> write to cache, flush to DB later. Very fast writes, risk of loss if the cache dies.</li>
<li><strong>Write-around:</strong> write only to DB; the cache fills on read. Good when written data is rarely read soon.</li>
</ul>
<h2>Eviction</h2>
<p><strong>LRU</strong> drops the least recently used item. <strong>LFU</strong> drops the least frequently used. <strong>TTL</strong> expires items after a time, which also bounds how stale data can get.</p>
<h2>The hard parts</h2>
<ul>
<li><strong>Invalidation:</strong> when data changes, delete or update the cached copy. Usually: write DB, then delete the cache key.</li>
<li><strong>Stampede (thundering herd):</strong> a hot key expires and 10,000 requests hit the DB at once. Fixes: let one request rebuild it (locking/request coalescing), or refresh before expiry.</li>
<li><strong>Hot keys:</strong> one key (a celebrity profile) overloads one cache node. Fix: replicate that key or add a small in-process cache.</li>
</ul>`,
      pros: ['Reads in under 1 ms instead of 10–100 ms', 'Shields the database from most traffic', 'Cheap: a little RAM saves a lot of DB'],
      cons: ['Data can be stale', 'Invalidation bugs are subtle', 'Another system to run and monitor'],
      takeaways: ['Cache read-heavy, rarely-changing data first.', 'Cache-aside + TTL is the default pattern.', 'Plan for invalidation, stampedes and hot keys.'],
      tip: 'Always say what you cache, the pattern, the TTL, and what happens on a miss or when data changes. “Menus are cached cache-aside with a 5-minute TTL and deleted on edit.”',
      seen: ['zomato', 'swiggy', 'url-shortener', 'instagram'],
      quiz: [
        { q: 'In cache-aside, what happens on a cache miss?', o: ['Return an error', 'App reads from DB, then stores the result in the cache', 'The cache reads the DB by itself and blocks writes', 'Request is dropped'], a: 1, why: 'The application is responsible for loading the cache on misses.' },
        { q: 'A hot key expires and the DB gets 10K identical queries. This is…', o: ['A cache stampede', 'Replication lag', 'A deadlock', 'Sharding'], a: 0, why: 'Fix with request coalescing, a rebuild lock, or early refresh.' },
        { q: 'Which pattern risks losing data if the cache crashes?', o: ['Cache-aside', 'Write-through', 'Write-back', 'Write-around'], a: 2, why: 'Write-back holds writes in the cache before flushing to the DB.' },
      ],
    },
    {
      id: 'cdn', level: 2, mins: 7, title: 'CDNs', sim: 'cdn',
      short: 'Copies of images and video in every city. Pull vs push, TTLs.',
      keywords: 'cdn edge cloudfront akamai cloudflare static content pop',
      tldr: 'A Content Delivery Network keeps copies of your static files (images, JS, video) on servers in hundreds of cities, so users download them from nearby instead of from your origin.',
      analogy: 'A chain with a central kitchen in Mumbai and small outlets across India. Popular items are stocked at each outlet, so customers in Chennai don’t wait for a delivery from Mumbai.',
      simIntro: 'Press “Everyone at once” with the CDN off. Then turn it on and press it twice. The first round fills the edges, the second is fast everywhere.',
      body: `
<h2>How it works</h2>
<p>Your files get a CDN URL (<code>cdn.example.com/menu/biryani.jpg</code>). DNS sends each user to the nearest <strong>edge</strong> (point of presence). If the edge has the file, it serves it. If not, it fetches from your <strong>origin</strong>, stores it, then serves it.</p>
<h2>Pull vs push</h2>
<ul><li><strong>Pull CDN:</strong> edges fetch on first request (as in the sim). Easy; first user per region pays a miss.</li>
<li><strong>Push CDN:</strong> you upload content to the CDN ahead of time. Good for big known files like a new episode before release.</li></ul>
<h2>Keeping it fresh</h2>
<p>Use <code>Cache-Control: max-age</code> headers for TTL. For files that change, use <strong>versioned names</strong> (<code>app.3f9a2.js</code>) so a new version is a new URL and nothing needs purging.</p>
<h2>Beyond static files</h2>
<p>Modern CDNs also absorb DDoS attacks, terminate TLS near users, cache some API responses, and run small functions at the edge. Netflix runs its own CDN (Open Connect) with servers placed inside internet providers’ networks.</p>`,
      takeaways: ['CDNs cut latency by serving from nearby edges.', 'They also cut origin load and bandwidth bills.', 'Version file names instead of purging.'],
      tip: 'Any design with images, video or a web front end should get a CDN in the first diagram. Say what goes through it and the TTL.',
      seen: ['netflix', 'hotstar', 'instagram', 'zomato'],
      quiz: [
        { q: 'The first user in Sydney requests a new image through a pull CDN. What happens?', o: ['They get an error', 'Edge misses, fetches from origin, caches it, serves it', 'Origin pushes it to all edges', 'DNS fails'], a: 1, why: 'Pull CDNs fill on demand. Only the first request per edge is slow.' },
        { q: 'Best way to ship a new version of app.js through a CDN?', o: ['Purge every edge', 'Give it a new versioned file name', 'Set TTL to 0 forever', 'Skip the CDN'], a: 1, why: 'A new name is a new cache key, so users get the new file instantly and old caches don’t matter.' },
      ],
    },
    {
      id: 'databases', level: 2, mins: 11, title: 'SQL vs NoSQL', sim: 'dbPicker',
      short: 'Relational, document, key-value, wide-column, graph. How to choose.',
      keywords: 'sql nosql postgres mysql mongodb cassandra dynamodb redis acid database',
      tldr: 'Relational (SQL) databases store tables with strict schemas and strong transactions. NoSQL databases trade some of that for flexible data or easier scaling across many machines. Pick by data shape and access pattern.',
      analogy: 'SQL is a well-organised filing cabinet with labelled folders and rules. NoSQL is a set of specialised storage: a locker room (key-value), a bookshelf of binders (documents), a warehouse with numbered aisles (wide-column).',
      simIntro: 'Answer four questions and see what kind of database fits. Try: JSON documents + money involved. Then: huge event stream + many servers.',
      body: `
<h2>Relational databases (PostgreSQL, MySQL)</h2>
<p>Tables, rows, foreign keys, joins, SQL. They give <strong>ACID</strong> transactions:</p>
<ul><li><strong>Atomic:</strong> all steps of a transaction happen, or none.</li>
<li><strong>Consistent:</strong> rules (constraints) always hold.</li>
<li><strong>Isolated:</strong> concurrent transactions don’t see each other’s half-done work.</li>
<li><strong>Durable:</strong> once committed, it survives a crash.</li></ul>
<p>Use for orders, payments, inventory, users: anything where correctness matters. A single well-tuned Postgres handles more than most startups ever need.</p>
<h2>NoSQL families</h2>
<div class="table-wrap"><table>
<tr><th>Type</th><th>Examples</th><th>Good for</th></tr>
<tr><td>Key-value</td><td>Redis, DynamoDB</td><td>Sessions, carts, counters, caches</td></tr>
<tr><td>Document</td><td>MongoDB, Firestore</td><td>Catalogs, profiles, varied JSON</td></tr>
<tr><td>Wide-column</td><td>Cassandra, ScyllaDB, HBase</td><td>Huge write volumes: messages, events, time series</td></tr>
<tr><td>Graph</td><td>Neo4j</td><td>Social graphs, fraud detection</td></tr>
<tr><td>Search</td><td>Elasticsearch</td><td>Full-text search, filters, ranking</td></tr></table></div>
<h2>Polyglot persistence</h2>
<p>Real systems mix them. A food app might keep orders in Postgres, menus cached in Redis, restaurant search in Elasticsearch, and location pings in Cassandra. Each store does what it is best at.</p>`,
      pros: ['SQL: transactions, joins, mature tools', 'NoSQL: flexible schema, scales out easily', 'NoSQL: very high write throughput'],
      cons: ['SQL: harder to scale writes across machines', 'NoSQL: weaker or no joins and transactions', 'NoSQL: you model tables around your queries'],
      prosLabel: 'Strengths', consLabel: 'Weaknesses',
      takeaways: ['Default to SQL unless you have a clear reason.', 'Choose NoSQL for scale, flexible shape, or a specific access pattern.', 'Mixing databases per job is normal.'],
      tip: 'Justify the database by access pattern: “Messages are written constantly and read by chat id and time, so a wide-column store keyed by (chat_id, timestamp) fits.”',
      seen: ['whatsapp', 'upi', 'swiggy', 'zomato'],
      quiz: [
        { q: 'A bank transfer must debit one account and credit another, or do neither. Which property?', o: ['Atomicity', 'Availability', 'Partitioning', 'Eventual consistency'], a: 0, why: 'Atomic transactions are all-or-nothing.' },
        { q: 'Storing billions of chat messages, read by conversation and time. Best fit?', o: ['Graph DB', 'Wide-column store like Cassandra', 'Spreadsheet', 'Single MySQL table on one server'], a: 1, why: 'Wide-column stores handle huge write volumes and range reads within a partition.' },
      ],
    },
    {
      id: 'indexing', level: 2, mins: 7, title: 'Database indexes', sim: 'index',
      short: 'Why one query takes 2 ms and another takes 20 s.',
      keywords: 'index b-tree query performance composite index full scan',
      tldr: 'An index is a sorted lookup structure (usually a B-tree) that lets the database jump to matching rows instead of reading the whole table. It speeds up reads and slows down writes a little.',
      analogy: 'The index at the back of a textbook. Without it, finding “sharding” means reading every page. With it, you jump to page 214.',
      simIntro: 'Scan for a user, then use the index. Count the rows read each way.',
      body: `
<h2>How it works</h2>
<p>A <strong>B-tree index</strong> keeps keys sorted in a shallow tree. Finding one key among 10 million takes about 3–4 page reads. Without an index, the database does a <strong>full table scan</strong>.</p>
<h2>What to index</h2>
<ul><li>Columns in <code>WHERE</code>, <code>JOIN</code> and <code>ORDER BY</code> of your frequent queries.</li>
<li><strong>Composite indexes</strong> on several columns: <code>(restaurant_id, created_at)</code> serves “latest orders for restaurant 9”. Order matters: it helps queries that filter on the left-most columns.</li>
<li><strong>Covering index:</strong> includes every column a query needs, so the table itself isn’t touched.</li></ul>
<h2>The cost</h2>
<p>Each index is another structure to update on every insert and update, and takes disk space. A write-heavy table with ten indexes gets slow. Index for the queries you actually run, and check with <code>EXPLAIN</code>.</p>`,
      takeaways: ['Indexes turn O(n) scans into O(log n) lookups.', 'Composite index column order matters.', 'Every index slows writes. Don’t index everything.'],
      tip: 'When you show a table schema, name the indexes for your main queries. It shows you think about how data is read, not just stored.',
      seen: ['zomato', 'url-shortener'],
      quiz: [
        { q: 'Index on (city, rating). Which query can use it best?', o: ['WHERE rating > 4', 'WHERE city = \'Pune\' AND rating > 4', 'WHERE name LIKE \'%pizza%\'', 'ORDER BY created_at'], a: 1, why: 'Composite indexes work left to right. Filtering on city first matches the index.' },
        { q: 'Main downside of adding many indexes?', o: ['Reads get slower', 'Writes get slower and storage grows', 'Data becomes inconsistent', 'Queries return wrong rows'], a: 1, why: 'Every insert and update must also update each index.' },
      ],
    },
    {
      id: 'api-design', level: 2, mins: 9, title: 'API design',
      short: 'REST, GraphQL, gRPC. Pagination, versioning, status codes.',
      keywords: 'api rest graphql grpc pagination cursor versioning http status',
      tldr: 'An API is the contract between client and server. Good APIs are predictable, paginated, versioned and safe to retry.',
      analogy: 'A restaurant menu. Customers order only what is listed, in a fixed format. Change the menu carelessly and regulars get confused.',
      body: `
<h2>REST</h2>
<p>Resources as URLs, actions as HTTP verbs. The default for public and mobile APIs.</p>
<div class="calc">GET    /restaurants/42/menu        read<br>POST   /orders                     create (send an Idempotency-Key header)<br>GET    /orders/9001                read one<br>PATCH  /orders/9001  {status}      partial update<br>DELETE /cart/items/7               remove</div>
<p>Status codes carry meaning: <code>200</code> OK, <code>201</code> Created, <code>400</code> bad input, <code>401</code> not logged in, <code>403</code> not allowed, <code>404</code> not found, <code>409</code> conflict, <code>429</code> too many requests, <code>500</code> server bug, <code>503</code> temporarily unavailable.</p>
<h2>GraphQL and gRPC</h2>
<ul><li><strong>GraphQL:</strong> one endpoint; the client asks for exactly the fields it needs. Great for varied front ends; harder to cache and rate limit.</li>
<li><strong>gRPC:</strong> binary, fast, strongly typed (Protocol Buffers), supports streaming. Common between internal services.</li></ul>
<h2>Pagination</h2>
<p><strong>Offset</strong> (<code>?page=50&amp;size=20</code>) is simple but slow deep down and skips or repeats items when data changes. <strong>Cursor</strong> (<code>?after=order_9001&amp;limit=20</code>) is stable and fast. Use cursors for feeds and long lists.</p>
<h2>Versioning and safety</h2>
<p>Version breaking changes (<code>/v2/orders</code> or a header). Make writes idempotent with keys so retries don’t create duplicate orders (see <a href="#t-idempotency">Idempotency</a>).</p>`,
      takeaways: ['REST for public APIs, gRPC between services, GraphQL for flexible clients.', 'Use cursor pagination for large or changing lists.', 'Version breaking changes and make writes retry-safe.'],
      tip: 'In interviews, list 3–5 core endpoints with method, path, key params and response. Keep it short and move on.',
      seen: ['url-shortener', 'swiggy', 'upi'],
      quiz: [
        { q: 'Best pagination for an infinite-scroll feed that changes constantly?', o: ['Offset/page number', 'Cursor-based', 'Return everything', 'Random sampling'], a: 1, why: 'Cursors stay stable when new items arrive and don’t slow down deep in the list.' },
        { q: 'Which status code tells a client it is being rate limited?', o: ['404', '409', '429', '503'], a: 2, why: '429 Too Many Requests, often with a Retry-After header.' },
      ],
    },
    {
      id: 'message-queues', level: 2, mins: 10, title: 'Message queues', sim: 'queue',
      short: 'Decouple services and survive spikes. Kafka, SQS, at-least-once.',
      keywords: 'queue kafka rabbitmq sqs pubsub async producer consumer dead letter backpressure',
      tldr: 'A message queue lets one service hand work to another without waiting. Producers drop messages in; consumers process them at their own pace. Spikes become a longer line instead of errors.',
      analogy: 'The order ticket rail in a restaurant kitchen. Waiters clip tickets on the rail and go back to guests. Cooks take tickets one by one. A rush means a longer rail, not angry waiters.',
      simIntro: 'Press “Dinner rush!” with the queue. Then switch to “No queue” and do it again. Add workers to drain faster.',
      body: `
<h2>Why use one</h2>
<ul><li><strong>Absorb spikes:</strong> process at a steady rate even when traffic jumps.</li>
<li><strong>Decouple:</strong> the order service doesn’t need to know who sends emails or updates analytics.</li>
<li><strong>Retry safely:</strong> if a consumer crashes, the message is still there.</li>
<li><strong>Respond fast:</strong> return “order placed” now; send the SMS and invoice in the background.</li></ul>
<h2>Two styles</h2>
<p><strong>Point-to-point queue</strong> (SQS, RabbitMQ): each message goes to one consumer. <strong>Pub/sub</strong> (Kafka topics, SNS): each message goes to every subscribed group. With Kafka, “OrderPlaced” can feed billing, notifications and analytics independently.</p>
<h2>Kafka in one paragraph</h2>
<p>Kafka is a durable, append-only log split into <strong>partitions</strong>. Messages with the same key (say <code>order_id</code>) go to the same partition and stay in order. A <strong>consumer group</strong> shares the partitions between its members. Messages are kept for days, so new consumers can replay history.</p>
<h2>Delivery guarantees</h2>
<p>Most queues are <strong>at-least-once</strong>: a message can arrive twice (consumer crashed after doing the work but before acknowledging). So consumers must be <strong>idempotent</strong>. Messages that keep failing go to a <strong>dead-letter queue</strong> for inspection.</p>`,
      pros: ['Smooths traffic spikes', 'Services fail independently', 'Easy to add new consumers'],
      cons: ['Work becomes eventually done, not instant', 'Duplicates: consumers must be idempotent', 'Harder to debug end-to-end'],
      takeaways: ['Queues turn spikes into waiting, not failures.', 'Kafka: partitions give ordering per key and parallelism.', 'Assume at-least-once delivery. Make consumers idempotent.'],
      tip: 'Use a queue whenever work doesn’t need to finish before you reply to the user: notifications, emails, analytics, video processing.',
      seen: ['swiggy', 'netflix', 'whatsapp', 'irctc'],
      quiz: [
        { q: 'Your consumer may receive the same message twice. What should it be?', o: ['Faster', 'Idempotent', 'Stateless', 'Synchronous'], a: 1, why: 'Processing the same message twice must have the same effect as once.' },
        { q: 'In Kafka, how do you keep all events of one order in order?', o: ['Use one topic per order', 'Use order_id as the message key so they share a partition', 'Use a single consumer for everything', 'You cannot'], a: 1, why: 'Ordering is guaranteed within a partition, and the key picks the partition.' },
      ],
    },

    /* =================== LEVEL 3 =================== */
    {
      id: 'replication', level: 3, mins: 10, title: 'Replication', sim: 'replication',
      short: 'Copies of data on many machines. Leaders, followers, lag and failover.',
      keywords: 'replication leader follower master slave replica failover lag quorum',
      tldr: 'Replication keeps copies of the same data on several machines. It gives you more read capacity and survives a machine dying, at the cost of copies sometimes disagreeing for a moment.',
      analogy: 'A head chef writes the day’s recipe changes. Assistant chefs copy them into their own notebooks. Ask an assistant right after a change and they may still have yesterday’s version.',
      simIntro: 'Deposit, then read immediately: a stale read. Deposit, then kill the leader before it replicates: a lost write. Switch to Sync and try again.',
      body: `
<h2>Leader–follower (primary–replica)</h2>
<p>All writes go to the <strong>leader</strong>. It streams changes to <strong>followers</strong>. Reads can go to followers. This is the default for MySQL and PostgreSQL setups.</p>
<ul><li><strong>Async replication:</strong> leader confirms immediately. Fast, but followers lag and a crash can lose recent writes.</li>
<li><strong>Sync replication:</strong> leader waits for followers. Safe, but slower and stalls if a follower is slow. Many systems use semi-sync: wait for one follower.</li></ul>
<h2>Failover</h2>
<p>When the leader dies, a follower is promoted (by a tool like Patroni, or the managed service). Pitfalls: picking a follower that is behind, and <strong>split brain</strong> where two nodes both think they’re leader.</p>
<h2>Other models</h2>
<ul><li><strong>Multi-leader:</strong> writes accepted in several regions. Needs conflict resolution.</li>
<li><strong>Leaderless (Dynamo, Cassandra):</strong> write to W of N replicas, read from R. If <code>W + R &gt; N</code>, a read overlaps the latest write. Typical: N=3, W=2, R=2.</li></ul>
<h2>Read-your-writes</h2>
<p>User updates their address, the page reloads from a lagging follower, and the old address shows. Fix: read your own recent writes from the leader, or wait for the follower to catch up.</p>`,
      takeaways: ['Replicas add read capacity and fault tolerance.', 'Async = fast but can lag or lose writes. Sync = safe but slower.', 'Watch for read-your-writes and split-brain issues.'],
      tip: 'Say “one leader, two followers across zones, semi-sync, reads from followers except a user’s own recent writes.” That one line shows you understand the trade-offs.',
      seen: ['upi', 'swiggy', 'instagram'],
      quiz: [
        { q: 'A user updates their profile and immediately sees the old one. Likely cause?', o: ['Cache hit', 'Reading from a lagging follower', 'DNS caching', 'Sharding'], a: 1, why: 'Async followers lag. Read-your-writes routing fixes it.' },
        { q: 'Leaderless store with N=3. Which W and R guarantee reads see the latest write?', o: ['W=1, R=1', 'W=2, R=2', 'W=1, R=2', 'W=3, R=0'], a: 1, why: 'W + R = 4 > 3, so read and write sets overlap.' },
      ],
    },
    {
      id: 'sharding', level: 3, mins: 10, title: 'Sharding', sim: 'sharding',
      short: 'Split data across machines. Shard keys, hot spots, resharding.',
      keywords: 'sharding partitioning shard key hot spot range hash directory',
      tldr: 'Sharding splits one big dataset into pieces (shards) stored on different machines, so writes and storage scale beyond one server. The shard key decides everything.',
      analogy: 'A library too big for one building. Split it across buildings by the first letter of the author. Easy to find books. But if half your books are by authors starting with “S”, that building is packed.',
      simIntro: 'With “city” as the shard key, Bengaluru’s shard overflows. Switch to hash(order_id) and see the load even out.',
      body: `
<h2>Strategies</h2>
<ul>
<li><strong>Range:</strong> users A–F on shard 1, G–M on shard 2. Range queries are easy. Risk: hot ranges (new IDs all land on the last shard).</li>
<li><strong>Hash:</strong> <code>shard = hash(key) mod N</code>. Even spread. Range queries hit every shard. Changing N moves most data, which <a href="#t-consistent-hashing">consistent hashing</a> fixes.</li>
<li><strong>Directory / lookup:</strong> a table maps each key or tenant to a shard. Flexible, but the lookup service is critical.</li>
<li><strong>Geo:</strong> India users on Mumbai shards, EU users in Frankfurt. Good for latency and data laws.</li></ul>
<h2>Choosing a shard key</h2>
<p>Pick a key with many distinct values, even traffic, and that matches your main query. For chat: <code>conversation_id</code>, so a conversation’s messages live together. For orders: <code>order_id</code> hash for even writes, or <code>customer_id</code> if you mostly read “my orders”.</p>
<h2>What gets harder</h2>
<ul><li><strong>Cross-shard queries and joins</strong> must ask several shards and merge (scatter-gather).</li>
<li><strong>Cross-shard transactions</strong> need two-phase commit or sagas. Design to avoid them.</li>
<li><strong>Resharding</strong> while live is a big project. Start with more logical shards than machines (say 1,024 logical shards on 8 servers) so you can move shards instead of splitting them.</li></ul>`,
      takeaways: ['Shard only when one machine (plus replicas) truly can’t keep up.', 'The shard key should spread load evenly and match your main query.', 'Plan for resharding from day one with many logical shards.'],
      tip: 'Name the shard key and explain why it avoids hot spots. Then mention one query that becomes harder and how you handle it.',
      seen: ['whatsapp', 'instagram', 'upi', 'url-shortener'],
      quiz: [
        { q: 'Sharding by signup date for a growing app causes…', o: ['Even load', 'All new writes hitting the newest shard', 'Faster joins', 'Nothing special'], a: 1, why: 'Range sharding on a time-like key creates a hot latest shard.' },
        { q: 'Biggest cost of hash sharding?', o: ['Uneven load', 'Range queries must ask every shard', 'It cannot use SSDs', 'It needs a CDN'], a: 1, why: 'Neighboring keys are scattered, so ranges become scatter-gather.' },
      ],
    },
    {
      id: 'consistent-hashing', level: 3, mins: 9, title: 'Consistent hashing', sim: 'ring',
      short: 'Add a server and only a few keys move. The ring and virtual nodes.',
      keywords: 'consistent hashing ring virtual nodes vnode cassandra dynamo cache cluster',
      tldr: 'Consistent hashing places servers and keys on a circle. Each key belongs to the next server clockwise. Adding or removing a server only moves the keys next to it, instead of reshuffling everything.',
      analogy: 'Delivery zones around a ring road. Each rider covers the stretch up to the next rider. If a new rider joins, only the neighbor’s stretch is split. Everyone else keeps their route.',
      simIntro: 'Add a server and compare “Keys moved (ring)” with “Would move (hash % N)”. Then switch on virtual nodes and watch the bars even out.',
      body: `
<h2>The problem it solves</h2>
<p>With <code>hash(key) % N</code>, going from 4 to 5 servers changes the answer for ~80% of keys. For a cache cluster that means most of the cache goes cold at once and the database gets hammered.</p>
<h2>How the ring works</h2>
<ol><li>Hash each server’s name to a point on a circle (0 to 2³²).</li><li>Hash each key to a point.</li><li>Walk clockwise from the key; the first server you meet owns it.</li></ol>
<p>Adding a server takes over only the keys between it and the previous server: about <code>1/N</code> of keys.</p>
<h2>Virtual nodes</h2>
<p>With few servers, random positions give uneven slices. Give each server many points (100–200 “vnodes”). Load evens out, and a bigger machine can simply get more vnodes.</p>
<h2>Where it’s used</h2>
<p>Amazon’s Dynamo paper, Cassandra’s token ring, Memcached client libraries, load balancers that want sticky routing, and CDNs choosing which cache server holds a URL.</p>`,
      takeaways: ['hash % N reshuffles almost everything when N changes.', 'The ring moves only ~1/N of keys per change.', 'Virtual nodes fix uneven distribution.'],
      tip: 'When you shard a cache or a database, say “consistent hashing with virtual nodes so adding capacity moves minimal data.”',
      seen: ['url-shortener', 'whatsapp', 'netflix'],
      quiz: [
        { q: '10 servers, consistent hashing. You add 1. Roughly what share of keys move?', o: ['~1/11', '~50%', '~90%', 'All of them'], a: 0, why: 'Only keys in the new server’s slice move.' },
        { q: 'Why use virtual nodes?', o: ['Encrypt keys', 'Spread load evenly across servers', 'Make hashing faster', 'Avoid replication'], a: 1, why: 'Many points per server averages out the slice sizes.' },
      ],
    },
    {
      id: 'cap-theorem', level: 3, mins: 9, title: 'CAP theorem', sim: 'cap',
      short: 'When the network splits, choose: correct answers or any answer.',
      keywords: 'cap theorem consistency availability partition tolerance pacelc',
      tldr: 'In a distributed system, network splits (partitions) will happen. During one, you must choose: refuse some requests to stay consistent (CP), or answer everything and risk stale or conflicting data (AP).',
      analogy: 'Two ticket counters at a station whose phone line just died. Either both stop selling the last seats until the line is back (consistent), or both keep selling and risk selling the same seat twice (available).',
      simIntro: 'Cut the network. In CP mode, bookings are refused. In AP mode, both sides sell, and healing reveals an overbooking.',
      body: `
<h2>The three letters</h2>
<ul><li><strong>C · Consistency:</strong> every read sees the latest write.</li>
<li><strong>A · Availability:</strong> every request to a working node gets a non-error answer.</li>
<li><strong>P · Partition tolerance:</strong> the system keeps working when nodes can’t talk.</li></ul>
<p>Networks fail, so P isn’t optional. The real choice is <strong>C or A during a partition</strong>.</p>
<h2>Which to pick</h2>
<div class="table-wrap"><table><tr><th>Choose</th><th>When wrong data is worse than no data</th><th>Examples</th></tr>
<tr><td><strong>CP</strong></td><td>Payments, seat booking, inventory, bank balances</td><td>HBase, etcd/ZooKeeper, Spanner, most SQL setups</td></tr>
<tr><td><strong>AP</strong></td><td>Likes, views, feeds, shopping carts, presence</td><td>Cassandra, DynamoDB (default), DNS</td></tr></table></div>
<p>One app often uses both: a CP store for the booking, an AP store for the “12 people are viewing this” counter.</p>
<h2>PACELC: the rest of the story</h2>
<p>If Partition: choose A or C. Else (normal times): choose Latency or Consistency. Even without failures, waiting for replicas to agree costs time. Strongly consistent systems are slower every day, not just during outages.</p>`,
      takeaways: ['Partitions happen; choose C or A for that moment.', 'Money and inventory: CP. Social counters and feeds: AP.', 'PACELC: even in normal times, consistency costs latency.'],
      tip: 'Don’t just recite CAP. Apply it to one feature: “For seat inventory I choose consistency, so during a partition we show ‘try again’ rather than double-book.”',
      seen: ['irctc', 'upi', 'whatsapp', 'instagram'],
      quiz: [
        { q: 'For a like counter on posts, which is usually better during a partition?', o: ['CP: refuse to count', 'AP: keep counting, reconcile later', 'Shut down the app', 'Neither applies'], a: 1, why: 'A slightly wrong like count is harmless; errors are not.' },
        { q: 'Why is P not really optional?', o: ['It is required by law', 'Networks between machines can and do fail', 'It makes things faster', 'Databases demand it'], a: 1, why: 'Any multi-machine system will see partitions eventually.' },
      ],
    },
    {
      id: 'consistency-models', level: 3, mins: 8, title: 'Consistency models',
      short: 'Strong, eventual, read-your-writes. ACID vs BASE.',
      keywords: 'strong eventual consistency linearizable read your writes acid base isolation',
      tldr: 'Consistency models describe what a reader may see after a write. Strong consistency means “always the latest”; eventual consistency means “the latest, soon”. There are useful steps in between.',
      analogy: 'News spreading in a family WhatsApp group. Strong: everyone gets it at the same instant. Eventual: everyone will know by evening, but your aunt might still be talking about the old news for an hour.',
      body: `
<h2>The ladder, strongest first</h2>
<ul>
<li><strong>Strong / linearizable:</strong> once a write is done, every read sees it. Feels like one machine. Costs latency.</li>
<li><strong>Sequential / causal:</strong> everyone sees related events in the same order (a reply never appears before its question).</li>
<li><strong>Read-your-writes:</strong> you always see your own changes, others may lag.</li>
<li><strong>Monotonic reads:</strong> you never see time go backwards (newer, then older data).</li>
<li><strong>Eventual:</strong> if writes stop, all copies converge. No promise about when.</li></ul>
<h2>ACID vs BASE</h2>
<p><strong>ACID</strong> (relational DBs): atomic, consistent, isolated, durable transactions. <strong>BASE</strong> (many NoSQL systems): Basically Available, Soft state, Eventually consistent. Different defaults for different jobs.</p>
<h2>Isolation levels in one breath</h2>
<p>Read committed (default in Postgres) avoids reading uncommitted data. Repeatable read / snapshot gives a stable view during a transaction. Serializable behaves as if transactions ran one at a time: safest, slowest. Seat booking and wallet debits often use <code>SELECT … FOR UPDATE</code> row locks or serializable transactions.</p>`,
      takeaways: ['Pick the weakest model the feature can tolerate; it is cheaper and faster.', 'Read-your-writes covers most user-facing surprises.', 'Use locks or serializable isolation where double-spending is possible.'],
      tip: 'Use precise words: “eventually consistent with read-your-writes for the author” beats a vague “it’s consistent”.',
      seen: ['upi', 'irctc', 'instagram'],
      quiz: [
        { q: 'You post a comment and refresh. Which guarantee ensures you see it?', o: ['Eventual consistency', 'Read-your-writes', 'Availability', 'Partition tolerance'], a: 1, why: 'Read-your-writes guarantees a user sees their own updates.' },
        { q: 'Two users try to book the last seat at the same moment. What prevents both succeeding?', o: ['A CDN', 'Row locking or serializable transactions', 'Eventual consistency', 'A bigger cache'], a: 1, why: 'Locks or strict isolation make the second booking see the seat is gone.' },
      ],
    },
    {
      id: 'object-storage', level: 3, mins: 6, title: 'Storing files: object storage',
      short: 'Photos and videos go to S3-like storage, not your database.',
      keywords: 'object storage s3 blob presigned url multipart upload files images video',
      tldr: 'Large files live in object storage (Amazon S3, Google Cloud Storage, Azure Blob). The database stores only the file’s key and metadata. A CDN serves the files to users.',
      analogy: 'A warehouse with numbered shelves. Your office records (database) just note “sofa is on shelf B-14”. You don’t carry sofas into the office.',
      body: `
<h2>The standard upload flow</h2>
<ol><li>Client asks your API: “I want to upload a photo.”</li>
<li>API returns a <strong>pre-signed URL</strong>: a time-limited link allowing upload of one object.</li>
<li>Client uploads directly to object storage. Your servers never touch the bytes.</li>
<li>Storage emits an event; a worker makes thumbnails, scans for abuse, and marks the photo ready in the DB.</li></ol>
<h2>Why not store files in the database?</h2>
<p>Huge rows slow backups, replication and caching. Object storage is cheap per GB, very durable (S3 is designed for 11 nines of durability), scales without limit and plugs into CDNs.</p>
<h2>Useful details</h2>
<ul><li><strong>Multipart upload:</strong> big files in chunks, resumable on bad networks.</li>
<li><strong>Storage classes:</strong> move old files to cheaper cold tiers.</li>
<li><strong>Content-addressed keys</strong> (hash of the file) give free deduplication.</li></ul>`,
      takeaways: ['Files → object storage, metadata → database, delivery → CDN.', 'Pre-signed URLs keep big uploads off your servers.', 'Process files asynchronously after upload.'],
      tip: 'Whenever a design has media, draw the pre-signed upload path and an async processing worker. Interviewers look for it.',
      seen: ['instagram', 'netflix', 'whatsapp'],
      quiz: [
        { q: 'Why give clients a pre-signed URL?', o: ['To encrypt the database', 'So they upload directly to storage without passing through your servers', 'To make the file public forever', 'To skip authentication'], a: 1, why: 'It saves your servers’ bandwidth and CPU while staying secure and time-limited.' },
      ],
    },

    /* =================== LEVEL 4 =================== */
    {
      id: 'rate-limiting', level: 4, mins: 9, title: 'Rate limiting', sim: 'tokenBucket',
      short: 'Stop abuse and overload. Token bucket, sliding window, 429s.',
      keywords: 'rate limit token bucket leaky bucket sliding window fixed window 429 throttling',
      tldr: 'A rate limiter caps how many requests a user, IP or API key can make in a time window. It protects you from bots, bugs and overload, and keeps one customer from hurting others.',
      analogy: 'A bouncer with a stack of entry tokens that refills slowly. Each person needs a token to enter. A group of five can enter at once if tokens are there; a crowd of fifty waits.',
      simIntro: 'Hit “Burst ×10” with a bucket of 5. Five pass, five get 429. Then turn on the bursty bot and tune size and refill.',
      body: `
<h2>Algorithms</h2>
<ul>
<li><strong>Token bucket:</strong> tokens refill at a steady rate up to a cap. Allows short bursts. Used widely (AWS API Gateway, Stripe).</li>
<li><strong>Leaky bucket:</strong> requests queue and leave at a fixed rate. Smooth output, no bursts.</li>
<li><strong>Fixed window:</strong> count per minute. Simple, but 2× bursts at window edges (59s and 61s).</li>
<li><strong>Sliding window log / counter:</strong> track recent timestamps, or blend two windows. Accurate, a bit more memory.</li></ul>
<h2>Where it runs</h2>
<p>Usually at the API gateway or load balancer, before your app. With many gateway instances, counters live in a shared store like <strong>Redis</strong> (atomic <code>INCR</code> with expiry, or a Lua script for token buckets).</p>
<h2>Being polite</h2>
<p>Return <code>429 Too Many Requests</code> with <code>Retry-After</code> and headers like <code>X-RateLimit-Remaining</code>. Limit by user or API key when possible, not just IP (many users share IPs behind mobile carriers).</p>`,
      takeaways: ['Token bucket: steady rate + burst allowance.', 'Shared counters in Redis for distributed limiters.', 'Return 429 with Retry-After; limit per user or key.'],
      tip: '“Design a rate limiter” is a classic question. Cover algorithm, where it sits, where counters live, what to do when Redis is down (fail open or closed?), and response headers.',
      seen: ['irctc', 'upi', 'url-shortener'],
      quiz: [
        { q: 'Which algorithm allows short bursts but caps the long-term rate?', o: ['Fixed window', 'Token bucket', 'Leaky bucket', 'Round robin'], a: 1, why: 'Bucket size = burst; refill rate = long-term average.' },
        { q: '20 API gateway servers must share one limit per user. Counters should live…', o: ['In each server’s memory', 'In a shared fast store like Redis', 'In the CDN', 'In the client'], a: 1, why: 'Local counters would let a user get 20× the limit.' },
      ],
    },
    {
      id: 'resilience', level: 4, mins: 10, title: 'Timeouts, retries, circuit breakers', sim: 'breaker',
      short: 'Stop one sick service from taking down everything.',
      keywords: 'circuit breaker retry backoff jitter timeout bulkhead fallback cascading failure resilience',
      tldr: 'In a system of many services, one slow dependency can freeze everyone waiting on it. Timeouts, careful retries, circuit breakers and fallbacks contain the damage.',
      analogy: 'A house’s electrical breaker. When a heater shorts, the breaker trips and cuts that circuit, so the whole house doesn’t catch fire. Later you flip it back to test.',
      simIntro: 'Set Payments to Down. The breaker counts failures, opens, fails fast for 4 seconds, then sends one trial request. Set Payments back to Healthy to see it close.',
      body: `
<h2>The toolkit</h2>
<ul>
<li><strong>Timeouts:</strong> never wait forever. Every network call needs one, shorter than the caller’s own deadline.</li>
<li><strong>Retries with exponential backoff and jitter:</strong> retry after 100 ms, 200 ms, 400 ms… plus randomness, so thousands of clients don’t retry in sync. Only retry idempotent operations.</li>
<li><strong>Circuit breaker:</strong> after N failures, stop calling the dependency for a while (open), then test with one request (half-open), then resume (closed).</li>
<li><strong>Fallbacks:</strong> show cached data, a default, or a reduced feature. “Recommendations unavailable” beats an error page.</li>
<li><strong>Bulkheads:</strong> separate thread pools or connection pools per dependency, so a slow one can’t eat every thread.</li>
<li><strong>Load shedding:</strong> under extreme load, reject low-priority work early to keep critical paths alive.</li></ul>
<h2>Cascading failures</h2>
<p>Payments slows down → Order service threads pile up waiting → Order service stops answering → the app’s home page, which calls Order service, times out. A breaker at the first hop stops the chain. Netflix popularised this with its Hystrix library.</p>`,
      takeaways: ['Every remote call: timeout + limited retries with backoff and jitter.', 'Circuit breakers fail fast and let sick services recover.', 'Plan a fallback for every non-critical dependency.'],
      tip: 'When a design has service-to-service calls, add one sentence: “Calls have timeouts, retries with jittered backoff, and a circuit breaker with a cached fallback.”',
      seen: ['netflix', 'swiggy', 'upi'],
      quiz: [
        { q: 'Why add jitter to retry backoff?', o: ['To make retries faster', 'So many clients don’t retry at the exact same moments', 'To encrypt requests', 'To avoid timeouts'], a: 1, why: 'Synchronized retries create waves of load that keep the service down.' },
        { q: 'In the half-open state, a circuit breaker…', o: ['Blocks everything forever', 'Lets a trial request through to test recovery', 'Sends all traffic', 'Restarts the service'], a: 1, why: 'Success closes the breaker; failure re-opens it.' },
      ],
    },
    {
      id: 'idempotency', level: 4, mins: 7, title: 'Idempotency',
      short: 'Retry a payment without charging twice.',
      keywords: 'idempotency idempotent key exactly once deduplication retry payment',
      tldr: 'An operation is idempotent if doing it twice has the same effect as doing it once. Networks drop replies, clients retry, queues redeliver, so every important write must be safe to repeat.',
      analogy: 'A lift button. Pressing it five times doesn’t call five lifts. Your “Pay ₹500” button should work the same way.',
      body: `
<h2>Why duplicates happen</h2>
<p>You tap Pay. The server charges the card, but the response is lost in a tunnel. The app retries. Without protection, you are charged twice. Queues with at-least-once delivery cause the same problem inside your backend.</p>
<h2>The idempotency key pattern</h2>
<ol><li>Client creates a unique key (UUID) per user action and sends it: <code>Idempotency-Key: 7c9e…</code></li>
<li>Server checks a table (or Redis) for that key.</li>
<li>New key: do the work, store the key with the result, return it.</li>
<li>Seen key: return the stored result. Do nothing else.</li></ol>
<p>Store key + result in the same database transaction as the work, or use a unique constraint, so a crash can’t leave them out of sync. Stripe’s API works this way.</p>
<h2>Naturally idempotent operations</h2>
<p><code>GET</code>, <code>PUT</code> (set to a value) and <code>DELETE</code> are idempotent by design. <code>POST</code> (create) and “add ₹100” are not. Prefer “set status = PAID where status = PENDING” over “toggle”.</p>
<h2>Exactly-once is a myth, mostly</h2>
<p>True exactly-once delivery across networks isn’t possible in general. What you build is <strong>at-least-once delivery + idempotent processing = effectively once</strong>.</p>`,
      takeaways: ['Assume every request and message can arrive twice.', 'Use client-generated idempotency keys for writes.', 'At-least-once + dedupe = effectively once.'],
      tip: 'In any payment, booking or order design, say the words “idempotency key” early. It is one of the strongest signals of real-world experience.',
      seen: ['upi', 'swiggy', 'irctc'],
      quiz: [
        { q: 'Which operation is naturally idempotent?', o: ['POST /orders', 'balance = balance + 100', 'PUT /users/7/email = a@b.com', 'Send SMS'], a: 2, why: 'Setting a value to X twice leaves it at X.' },
        { q: 'Where should the idempotency key come from?', o: ['The server, after processing', 'The client, once per user action, reused on retries', 'The database auto-increment', 'A random value on each retry'], a: 1, why: 'The same key on retries is what lets the server recognise a duplicate.' },
      ],
    },
    {
      id: 'realtime', level: 4, mins: 9, title: 'Real-time: polling, SSE, WebSockets', sim: 'realtime',
      short: 'Live tracking and chat. Push vs pull, and scaling open connections.',
      keywords: 'websocket polling long polling sse server sent events realtime push live tracking',
      tldr: 'For live updates (driver location, chat), polling wastes requests and adds delay. WebSockets keep a connection open so the server can push the moment something changes.',
      analogy: 'Polling is asking “are we there yet?” every few minutes. WebSocket is the driver telling you as you arrive.',
      simIntro: 'Set polling to 1 s: many empty requests. Set it to 6 s: updates arrive late. The WebSocket lane is fast without waste.',
      body: `
<h2>Options</h2>
<ul>
<li><strong>Short polling:</strong> ask every N seconds. Simple, wasteful, delayed.</li>
<li><strong>Long polling:</strong> server holds the request until there is news (or a timeout), then the client asks again. Better, still one request per message.</li>
<li><strong>Server-Sent Events (SSE):</strong> one long HTTP response the server keeps writing to. One-way (server → client). Great for live scores and notifications.</li>
<li><strong>WebSockets:</strong> full two-way connection. Chat, games, live tracking.</li></ul>
<h2>Scaling WebSockets</h2>
<p>Each open connection uses memory on one specific server, so connection servers are stateful. A well-tuned server holds 100K+ connections. To send a message to user X, you must know which server holds X’s socket:</p>
<ol><li>Keep a <strong>presence/connection registry</strong> (user → server) in Redis.</li>
<li>Or publish every message to a pub/sub channel (Redis Pub/Sub, Kafka) that connection servers subscribe to.</li></ol>
<p>Plan for reconnects (mobile networks drop constantly), heartbeats to detect dead connections, and resuming from the last message id.</p>`,
      takeaways: ['Polling is fine for slow-changing data. Push for live data.', 'SSE for one-way streams, WebSockets for two-way.', 'Connection servers are stateful: track who is connected where.'],
      tip: 'For chat or tracking, draw a separate “connection service” layer and explain how a message finds the right socket.',
      seen: ['whatsapp', 'uber', 'swiggy', 'hotstar'],
      quiz: [
        { q: 'Live cricket score updates, server → many viewers, one way. Simplest good fit?', o: ['Short polling every 100 ms', 'Server-Sent Events', 'FTP', 'Email'], a: 1, why: 'SSE is one-way push over plain HTTP, simple and efficient.' },
        { q: 'Why are WebSocket servers harder to scale than REST servers?', o: ['They need GPUs', 'Each connection lives on one server, so routing messages needs a registry or pub/sub', 'They cannot use TLS', 'They only work in browsers'], a: 1, why: 'The server holding a user’s socket must receive that user’s messages.' },
      ],
    },
    {
      id: 'geospatial', level: 4, mins: 9, title: 'Geospatial indexing', sim: 'geo',
      short: 'Find nearby drivers fast. Geohash, quadtrees, H3 hexagons.',
      keywords: 'geospatial geohash quadtree h3 s2 nearby location index uber',
      tldr: 'To answer “which drivers are near me?” without checking every driver, split the map into cells and file each driver under their cell. Then search only the nearby cells.',
      analogy: 'Finding a friend in a stadium. You don’t check all 50,000 seats. You go to their block, and if needed, the blocks next to it.',
      simIntro: 'Click the map to drop a rider. Only drivers in the 9 highlighted cells (amber) are checked.',
      body: `
<h2>Approaches</h2>
<ul>
<li><strong>Geohash:</strong> encodes lat/long into a string; longer = smaller cell. Nearby places share a prefix (mostly), so it works with ordinary indexes and Redis (<code>GEOSEARCH</code>).</li>
<li><strong>Quadtree:</strong> splits the map into 4 recursively, deeper where there are more points. Great for uneven density (city centers vs villages).</li>
<li><strong>Google S2:</strong> cells on a sphere, good coverage of any shape.</li>
<li><strong>Uber H3:</strong> hexagons. Every neighbor is the same distance away, which makes surge-pricing zones and supply/demand math cleaner.</li></ul>
<h2>Moving objects</h2>
<p>Drivers send their location every ~4 seconds. With 1M active drivers that’s 250K updates/s. Keep the live index in memory (Redis or an in-memory service sharded by region), not in a disk database. Write the history to a log (Kafka) for analytics and ETAs.</p>
<h2>Edge cases</h2>
<p>A rider near a cell border: always search neighbor cells too. Few results: widen the ring. Distance vs ETA: the nearest driver by air may be across a river; real systems rank by road ETA.</p>`,
      takeaways: ['Divide the map into cells; search the rider’s cell and neighbors.', 'Live locations belong in memory; history goes to a log.', 'Rank by ETA, not straight-line distance.'],
      tip: 'For Uber/Swiggy-style questions, compute the location update rate first. It justifies an in-memory, sharded geo index.',
      seen: ['uber', 'swiggy', 'zomato'],
      quiz: [
        { q: 'Why search neighbor cells and not just the rider’s cell?', o: ['To use more CPU', 'The closest driver may be just across a cell border', 'Cells are always empty', 'Required by GPS'], a: 1, why: 'Distance is continuous; cell borders are arbitrary.' },
        { q: '1M drivers send location every 4 s. Updates per second?', o: ['4K', '25K', '250K', '4M'], a: 2, why: '1,000,000 ÷ 4 = 250,000 per second.' },
      ],
    },
    {
      id: 'bloom-filters', level: 4, mins: 7, title: 'Bloom filters and sketches', sim: 'bloom',
      short: '“Definitely not” or “probably yes” using tiny memory.',
      keywords: 'bloom filter probabilistic hyperloglog count min sketch false positive',
      tldr: 'A Bloom filter answers “have I seen this before?” using a small bit array. It can say “probably yes” wrongly, but never says “no” wrongly. That lets you skip expensive lookups for things that surely don’t exist.',
      analogy: 'A bouncer who remembers only rough features. If someone has none of the features of anyone on the list, they’re definitely not on it. If they match, check the actual list.',
      simIntro: 'Check “vinay” (free), then “rahul” (probably taken). Add 10 random names and check more. Eventually you’ll catch a false positive.',
      body: `
<h2>How it works</h2>
<p>An array of <code>m</code> bits and <code>k</code> hash functions. To add an item, set the <code>k</code> bits it hashes to. To check, see if all <code>k</code> bits are set. Any zero means “definitely never added”.</p>
<h2>Where it’s used</h2>
<ul><li><strong>Databases like Cassandra and HBase:</strong> skip reading files on disk that can’t contain a key.</li>
<li><strong>Username or URL checks:</strong> avoid a DB hit for most free names.</li>
<li><strong>Caches/CDNs:</strong> only cache a URL on its second request, filtering out “one-hit wonders”.</li>
<li><strong>Browsers:</strong> checking URLs against a malicious-site list.</li></ul>
<h2>Family members</h2>
<ul><li><strong>HyperLogLog:</strong> counts unique items (unique viewers) in ~12 KB with ~1% error. Redis has <code>PFADD</code>/<code>PFCOUNT</code>.</li>
<li><strong>Count-min sketch:</strong> approximate frequency of items: trending hashtags, heavy hitters.</li></ul>`,
      takeaways: ['No false negatives; some false positives.', 'Tiny memory compared to storing every item.', 'HyperLogLog for unique counts, count-min for frequencies.'],
      tip: 'Mention a Bloom filter when you have “does X exist?” checks against a huge set, like “is this short URL already taken?”',
      seen: ['url-shortener', 'instagram', 'hotstar'],
      quiz: [
        { q: 'A Bloom filter says an item is NOT present. How sure are you?', o: ['50%', 'Probably', '100% certain', 'It never says that'], a: 2, why: 'A zero bit proves the item was never added.' },
        { q: 'Count unique viewers of a live match with tiny memory?', o: ['Bloom filter', 'HyperLogLog', 'B-tree', 'Linked list'], a: 1, why: 'HyperLogLog estimates distinct counts in kilobytes.' },
      ],
    },

    /* =================== LEVEL 5 =================== */
    {
      id: 'microservices', level: 5, mins: 9, title: 'Monolith vs microservices',
      short: 'When to split, API gateways, service discovery, and the hidden costs.',
      keywords: 'microservices monolith api gateway service discovery bounded context service mesh',
      tldr: 'A monolith is one deployable app. Microservices split it into small services, each owning its data and deployed on its own. Microservices help big teams move independently, at the cost of network calls and operational complexity.',
      analogy: 'A food court vs one big restaurant. In a food court each stall runs its own kitchen and menu, and can change without asking the others. But you need a shared seating area, payments, and someone to clean up when one stall floods.',
      body: `
<h2>Start with a monolith</h2>
<p>A well-structured monolith is faster to build, easier to debug and cheaper to run. Most successful companies (including Swiggy and Netflix) started this way and split later as teams and traffic grew.</p>
<h2>When microservices pay off</h2>
<ul><li>Many teams stepping on each other in one codebase.</li><li>Parts with very different scaling needs (search vs payments).</li><li>Parts that need different reliability or tech (ML models in Python, core in Java/Go).</li></ul>
<h2>Pieces you’ll need</h2>
<ul>
<li><strong>API gateway:</strong> one entry point for clients. Auth, rate limiting, routing to services.</li>
<li><strong>Service discovery:</strong> services find each other’s addresses (Kubernetes DNS, Consul).</li>
<li><strong>Database per service:</strong> no shared tables. Others ask through APIs or events.</li>
<li><strong>Observability:</strong> distributed tracing to follow one request through 15 services.</li>
<li><strong>Service mesh (optional):</strong> Envoy/Istio sidecars handle retries, mTLS, metrics.</li></ul>
<h2>Split by business capability</h2>
<p>Orders, Payments, Restaurants, Delivery, Notifications. Not by technical layer (“database service”, “UI service”). Each service should be able to change without coordinating releases with others.</p>`,
      pros: ['Teams deploy independently', 'Scale each part separately', 'A failure can be contained to one service'],
      cons: ['Network calls are slower and can fail', 'Distributed transactions are hard', 'Much more to monitor, deploy and secure'],
      takeaways: ['Monolith first; split when team or scale pain is real.', 'Split by business capability, one database per service.', 'You need a gateway, discovery and tracing before you need 50 services.'],
      tip: 'Don’t draw 20 microservices in an interview. Draw 4–6 major services for the core flows, and explain the boundary between them.',
      seen: ['swiggy', 'netflix', 'uber'],
      quiz: [
        { q: 'A good boundary for a microservice is…', o: ['A database table', 'A business capability like Payments', 'A programming language', 'One per developer'], a: 1, why: 'Business boundaries change together, so services stay independent.' },
        { q: 'What does an API gateway typically handle?', o: ['Storing orders', 'Auth, rate limiting and routing to services', 'Training ML models', 'Disk replication'], a: 1, why: 'It’s the single front door for clients.' },
      ],
    },
    {
      id: 'news-feeds', level: 5, mins: 9, title: 'Fan-out and news feeds', sim: 'fanout',
      short: 'Push vs pull timelines, and the celebrity problem.',
      keywords: 'news feed fan out push pull timeline celebrity hybrid instagram twitter',
      tldr: 'A feed shows posts from people you follow. Build it at write time (push into every follower’s feed) or at read time (pull from everyone you follow). Large systems mix both because of celebrities.',
      analogy: 'A newspaper. Push = printing a copy and delivering it to every subscriber’s door. Pull = each reader walks to every journalist’s desk each morning. For a journalist with 50 million readers, you print fewer copies and let readers pick it up.',
      simIntro: 'Post with 1K followers in push mode. Then drag to 50M and post again. Switch to Hybrid and compare.',
      body: `
<h2>Fan-out on write (push)</h2>
<p>When you post, a worker adds the post id to each follower’s pre-built feed (often a Redis list per user). Reading a feed is one fast lookup. Writes explode for accounts with millions of followers.</p>
<h2>Fan-out on read (pull)</h2>
<p>Posts are stored once. When you open the app, the service gathers recent posts from everyone you follow and merges them. Cheap writes, slow and expensive reads.</p>
<h2>Hybrid (what big apps do)</h2>
<p>Push for normal accounts. For celebrities (say &gt;100K followers), don’t push; at read time, merge the reader’s pre-built feed with recent posts from the few celebrities they follow. Also skip pushing to inactive users; build their feed when they return.</p>
<h2>Ranking</h2>
<p>Modern feeds aren’t just newest-first. A ranking service scores candidate posts (recency, closeness, engagement predictions) before returning the top N. Fan-out gathers candidates; ranking orders them.</p>`,
      takeaways: ['Push = fast reads, heavy writes. Pull = cheap writes, slow reads.', 'Hybrid handles celebrities by pulling their posts at read time.', 'Store post ids in feeds, not full posts.'],
      tip: 'For “design Instagram/Twitter”, the fan-out discussion and the celebrity edge case is the heart of the interview. Get there early.',
      seen: ['instagram', 'zomato'],
      quiz: [
        { q: 'Why not push a celebrity’s post to all 50M followers’ feeds?', o: ['It is illegal', 'It creates 50M writes per post and delays delivery', 'Followers can’t read it', 'Redis can’t store ids'], a: 1, why: 'Write amplification. Pull celebrity posts at read time instead.' },
        { q: 'In push mode, what makes reading a feed fast?', o: ['It’s pre-built per user', 'It uses a CDN', 'It skips auth', 'It uses SQL joins'], a: 0, why: 'The work was done at write time.' },
      ],
    },
    {
      id: 'event-driven', level: 5, mins: 10, title: 'Event-driven architecture',
      short: 'Events, the outbox pattern, sagas and CQRS.',
      keywords: 'event driven kafka outbox saga cqrs event sourcing choreography orchestration',
      tldr: 'Services publish events (“OrderPlaced”) instead of calling each other directly. Others react on their own. This keeps services loosely coupled, but needs patterns to stay correct across services.',
      analogy: 'A railway station announcement. The announcer says “Train 12951 arriving on platform 3”. Porters, food stalls and passengers each react. The announcer doesn’t phone each one.',
      body: `
<h2>Events vs commands</h2>
<p>A <strong>command</strong> says “do this” (ChargeCard). An <strong>event</strong> says “this happened” (OrderPlaced). Events let you add new reactions (loyalty points, fraud checks) without touching the publisher.</p>
<h2>The dual-write problem and the outbox</h2>
<p>Saving an order in the DB and publishing to Kafka are two separate actions. If the app crashes between them, they disagree. The <strong>transactional outbox</strong> fixes it: in the same DB transaction, insert the order and an “outbox” row. A relay (or Debezium change-data-capture) reads the outbox and publishes to Kafka.</p>
<h2>Sagas: transactions across services</h2>
<p>Placing an order touches Orders, Payments, Restaurant and Delivery. No single DB transaction can cover them. A <strong>saga</strong> runs local steps one by one and, if a step fails, runs <strong>compensating actions</strong> (refund the payment, cancel the order).</p>
<ul><li><strong>Choreography:</strong> each service listens and reacts. Simple for few steps, hard to follow for many.</li>
<li><strong>Orchestration:</strong> a coordinator (e.g. Temporal, AWS Step Functions) drives the steps. Easier to see and change.</li></ul>
<h2>CQRS and event sourcing</h2>
<p><strong>CQRS</strong> separates the write model from read models: writes go to a normalized DB; events build fast, denormalized views for reads (search index, dashboards). <strong>Event sourcing</strong> stores the events themselves as the source of truth and rebuilds state by replaying them. Powerful for audits, but complex.</p>`,
      takeaways: ['Publish events to decouple; consumers react independently.', 'Use the outbox pattern to avoid lost or phantom events.', 'Sagas with compensating actions replace cross-service transactions.'],
      tip: 'For multi-step flows like ordering or booking, say “saga with compensations, orchestrated, events published via outbox.” It covers the failure cases interviewers probe.',
      seen: ['swiggy', 'upi', 'irctc', 'netflix'],
      quiz: [
        { q: 'You save an order then publish OrderPlaced; the app crashes between the two. Which pattern prevents this?', o: ['Circuit breaker', 'Transactional outbox', 'CDN', 'Sharding'], a: 1, why: 'The event is saved in the same transaction as the order, then relayed.' },
        { q: 'Payment succeeded but the restaurant rejected the order. In a saga you…', o: ['Ignore it', 'Run a compensating action: refund', 'Roll back the whole internet', 'Retry forever'], a: 1, why: 'Sagas undo completed steps with compensations.' },
      ],
    },
    {
      id: 'observability', level: 5, mins: 8, title: 'Observability and SLOs',
      short: 'Metrics, logs, traces. SLIs, SLOs, error budgets, good alerts.',
      keywords: 'observability monitoring metrics logs traces slo sli sla error budget alerting',
      tldr: 'You can’t fix what you can’t see. Metrics tell you something is wrong, traces show where, logs explain why. SLOs turn “is it good enough?” into a number.',
      analogy: 'A car dashboard (metrics), a GPS trip history (traces) and a mechanic’s notes (logs). The dashboard warns you; the history and notes find the cause.',
      body: `
<h2>The three pillars</h2>
<ul><li><strong>Metrics:</strong> numbers over time. For services track <strong>RED</strong>: Rate, Errors, Duration. For machines track <strong>USE</strong>: Utilization, Saturation, Errors. (Prometheus, Grafana, Datadog.)</li>
<li><strong>Logs:</strong> structured events with a request id. (ELK, Loki.)</li>
<li><strong>Traces:</strong> one request’s path across services with timings. (OpenTelemetry, Jaeger.)</li></ul>
<h2>SLI, SLO, SLA</h2>
<ul><li><strong>SLI</strong> (indicator): “% of checkout requests under 500 ms and not 5xx.”</li>
<li><strong>SLO</strong> (objective): “99.9% over 30 days.” Internal target.</li>
<li><strong>SLA</strong> (agreement): what you promise customers, with penalties. Looser than the SLO.</li></ul>
<p>99.9% leaves an <strong>error budget</strong> of 0.1% (~43 minutes a month). Budget left? Ship faster. Budget burned? Freeze risky releases and fix reliability.</p>
<h2>Good alerts</h2>
<p>Alert on user-facing symptoms (error rate, latency SLO burn), not on every CPU spike. Every page to an on-call engineer should need a human action.</p>`,
      takeaways: ['Metrics detect, traces locate, logs explain.', 'Define SLOs from the user’s view; use error budgets to balance speed and safety.', 'Alert on symptoms, not causes.'],
      tip: 'End designs with “how we’d know it’s healthy”: two or three key metrics and an SLO. Few candidates do, so it stands out.',
      seen: ['netflix', 'hotstar', 'upi'],
      quiz: [
        { q: 'Which tool shows how long a single request spent in each of 12 services?', o: ['Metrics dashboard', 'Distributed tracing', 'CDN', 'Load balancer'], a: 1, why: 'Traces follow one request across services with timing spans.' },
        { q: 'SLO is 99.9% monthly. You’ve used the whole error budget by day 10. Typical response?', o: ['Ship more features faster', 'Slow risky releases and focus on reliability', 'Delete the SLO', 'Add more alerts on CPU'], a: 1, why: 'Error budgets exist to make this trade-off explicit.' },
      ],
    },
    {
      id: 'security', level: 5, mins: 8, title: 'Security basics',
      short: 'Auth, sessions vs JWT, OAuth, encryption, secrets.',
      keywords: 'security authentication authorization jwt session oauth oidc https encryption password hashing',
      tldr: 'Authentication checks who you are. Authorization checks what you may do. Encrypt data in transit and at rest, hash passwords, keep secrets out of code, and give every service the least access it needs.',
      analogy: 'An office building. The ID card at the gate is authentication. Which floors your card opens is authorization. The locked cabinet is encryption at rest.',
      body: `
<h2>Sessions vs tokens</h2>
<ul><li><strong>Server sessions:</strong> random session id in a cookie; data in Redis. Easy to revoke.</li>
<li><strong>JWT:</strong> a signed token holding the user id and claims. Services verify it without a DB call. Hard to revoke early, so keep them short-lived (minutes) with a refresh token.</li></ul>
<h2>OAuth 2.0 and OpenID Connect</h2>
<p>“Login with Google” uses OIDC (identity on top of OAuth 2.0). OAuth lets an app get limited access to another service on your behalf without your password.</p>
<h2>The non-negotiables</h2>
<ul><li>HTTPS everywhere; mTLS between internal services where possible.</li>
<li>Hash passwords with <strong>bcrypt, scrypt or Argon2</strong>, never plain SHA or reversible encryption.</li>
<li>Secrets in a vault (AWS Secrets Manager, HashiCorp Vault), never in Git.</li>
<li>Validate input; use parameterized queries (no SQL injection).</li>
<li>Least privilege: each service gets only the permissions it needs.</li>
<li>Rate limit login and OTP endpoints; log security events.</li></ul>`,
      takeaways: ['AuthN = who, AuthZ = what.', 'Short-lived JWTs + refresh tokens, or server sessions for easy revocation.', 'Hash passwords with Argon2/bcrypt; keep secrets in a vault.'],
      tip: 'One security sentence per design is enough unless asked: “Gateway validates JWTs, services use mTLS, PII encrypted at rest, OTP endpoint rate limited.”',
      seen: ['upi', 'irctc'],
      quiz: [
        { q: 'Best way to store user passwords?', o: ['Plain text', 'AES encryption', 'A slow salted hash like bcrypt or Argon2', 'Base64'], a: 2, why: 'Slow, salted hashes make stolen databases very costly to crack.' },
        { q: 'Main downside of long-lived JWTs?', o: ['They are slow to verify', 'They are hard to revoke before expiry', 'They need a database call each time', 'They cannot hold a user id'], a: 1, why: 'A stolen token stays valid until it expires, so keep them short.' },
      ],
    },
  ];
})();
