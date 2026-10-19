/* Case studies: data + an interactive architecture diagram with step-through request flows. */
(function () {
  const BP = window.BP;
  const { h, s } = BP;

  const TYPES = {
    client: ['CLIENT', 'var(--l2)'], cdn: ['CDN', 'var(--l1)'], gw: ['GATEWAY', 'var(--l3)'], lb: ['LOAD BALANCER', 'var(--l3)'],
    svc: ['SERVICE', 'var(--accent)'], db: ['DATABASE', 'var(--l4)'], cache: ['CACHE', 'var(--l5)'], queue: ['QUEUE / STREAM', 'var(--l3)'],
    ext: ['EXTERNAL', 'var(--muted)'], store: ['OBJECT STORAGE', 'var(--l4)'], search: ['SEARCH', 'var(--l1)'], ml: ['ML', 'var(--l3)'],
    rt: ['REALTIME', 'var(--l1)'], job: ['BATCH JOB', 'var(--muted)'],
  };
  const NOTE = 'A teaching design built from public talks, engineering blogs and common industry patterns. It is not the company’s exact internal architecture.';

  BP.CASES = [
    /* ------------------------------------------------------------ */
    {
      id: 'url-shortener', name: 'URL Shortener', letter: '↗', color: '#1F5FD1', levelLabel: 'Beginner', after: 2, focus: 'IDs, caching, read-heavy',
      tagline: 'The classic first question. Turn long links into short codes and redirect billions of clicks fast.',
      scale: [['100M', 'new links / month'], ['100 : 1', 'reads to writes'], ['~4K/s', 'avg redirects'], ['3.5T', 'codes with 7 base62 chars']],
      functional: ['Create a short link for a long URL', 'Redirect short link → long URL', 'Optional custom alias and expiry date', 'Click counts per link'],
      nonfunctional: ['Redirect p99 under 50 ms', '99.99% available for redirects', 'Codes must never collide', 'Links last for years'],
      estimates: `writes: 100M/month ÷ 2.6M s ≈ <span class="r">40/s</span><br>reads: 100 × writes ≈ <span class="r">4,000/s</span>, peak ≈ <span class="r">12,000/s</span><br>storage: 100M × 12 × 5 yrs = 6B links × 500 B ≈ <span class="r">3 TB</span><br>cache: 20% of daily hot links ≈ a few GB, fits in one Redis node`,
      api: `POST /urls  { long_url, custom_alias?, expires_at? }  → 201 { short_url }<br>GET  /{code}  → 301/302 Location: long_url<br>GET  /urls/{code}/stats  → { clicks, by_day }`,
      nodes: {
        user: [90, 260, 'client', 'User', 'browser / app', 'Anyone who creates or clicks a link.'],
        lb: [255, 260, 'lb', 'Load balancer', 'L7', 'Routes POST /urls to the write API and GET /{code} to the redirect service, so each scales on its own.'],
        api: [420, 140, 'svc', 'Write API', 'create links', 'Validates the URL, gets a unique id, encodes it in base62, and saves the mapping. Stateless.'],
        idgen: [585, 50, 'svc', 'ID range service', 'counter', 'Hands each Write API server a block of ids (say 10,000 at a time). Servers then mint ids locally with no coordination, and ids never collide.'],
        redirect: [420, 380, 'svc', 'Redirect service', 'hot path', 'The busiest component. Looks up the code (cache first), returns a redirect, and emits a click event without waiting for it.'],
        cache: [585, 380, 'cache', 'Redis', 'code → url', 'Holds hot mappings. A link that goes viral is read millions of times, so most redirects never touch the database.'],
        db: [750, 260, 'db', 'Links DB', 'key-value', 'Simple key → value lookups at scale. A key-value store (DynamoDB, Cassandra) or sharded MySQL keyed by code all work.'],
        q: [585, 480, 'queue', 'Click events', 'Kafka', 'Every redirect drops a small event here. Analytics consumes it later, so counting never slows the redirect.'],
        stats: [750, 480, 'svc', 'Analytics', 'counts', 'Aggregates clicks per link per day into a stats table.'],
      },
      edges: [['user', 'lb'], ['lb', 'api'], ['lb', 'redirect'], ['api', 'idgen'], ['api', 'db'], ['redirect', 'cache'], ['redirect', 'db'], ['redirect', 'q'], ['q', 'stats']],
      flows: [
        { name: 'Create a link', steps: [
          ['user', 'lb', '<b>POST /urls</b> with the long URL.'],
          ['lb', 'api', 'Routed to any Write API server.'],
          ['api', 'idgen', 'Only when its local block runs out: “give me ids 125,000,000–125,009,999”.'],
          ['idgen', 'api', 'Block granted. Next id is <b>125,000,123</b>. Base62 encode → <code>8sZ3a</code>.'],
          ['api', 'db', 'Store <code>{code: 8sZ3a, long_url, owner, created_at}</code>. Code is the primary key, so a duplicate would fail loudly.'],
          ['api', 'lb', '201 Created.'],
          ['lb', 'user', 'User gets <code>sho.rt/8sZ3a</code>.'],
        ] },
        { name: 'Click a link', steps: [
          ['user', 'lb', '<b>GET /8sZ3a</b>'],
          ['lb', 'redirect', 'Routed to the redirect pool.'],
          ['redirect', 'cache', 'Look up <code>8sZ3a</code> in Redis.'],
          ['cache', 'redirect', 'Hit for ~90% of clicks. On a miss: read the DB, then fill the cache.'],
          ['redirect', 'q', 'Fire-and-forget click event (code, time, country, referrer).'],
          ['redirect', 'lb', '<b>302 Found</b>, Location: the long URL.'],
          ['lb', 'user', 'Browser follows the redirect. Total server time: a few milliseconds.'],
          ['q', 'stats', 'Analytics updates counts in the background.'],
        ] },
      ],
      dives: [
        ['How to generate short codes', `<p>Three common options:</p><ul><li><strong>Hash the URL</strong> (MD5, take 7 chars). Same URL gives the same code, but collisions must be checked and retried.</li><li><strong>Counter + base62</strong> (shown above). No collisions, short codes. Sequential codes are guessable, so shuffle bits if that matters.</li><li><strong>Pre-generated key pool:</strong> a job fills a table of unused random codes; servers grab batches.</li></ul><p>7 base62 characters give 62⁷ ≈ 3.5 trillion codes, enough for centuries at 100M/month.</p>`],
        ['301 or 302?', '<p><strong>301 Moved Permanently</strong> lets browsers cache the redirect, so repeat clicks never reach you. Cheaper, but you lose click analytics. <strong>302 Found</strong> sends every click through you. Most shorteners with analytics use 302.</p>'],
        ['Scaling the read path', '<p>Reads are 100× writes, so: Redis in front of the DB, many stateless redirect servers, and optionally redirects at the CDN edge for the hottest links. Shard the DB by code with consistent hashing if one node isn’t enough.</p>'],
        ['Abuse and expiry', '<p>Rate limit link creation per user and IP. Check URLs against a malware list (a Bloom filter makes the “definitely safe” case cheap). A nightly job deletes expired links; the redirect service also checks <code>expires_at</code>.</p>'],
      ],
      tips: ['Start with the API and the 100:1 read/write ratio. It justifies caching right away.', 'Explain your code generation choice and how it avoids collisions.', 'Separate the hot redirect path from the write path.'],
      concepts: ['estimation', 'caching', 'load-balancing', 'consistent-hashing', 'message-queues', 'bloom-filters'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'swiggy', name: 'Swiggy', letter: 'S', color: '#E8690B', levelLabel: 'Intermediate', after: 3, focus: 'Orders, dispatch, live tracking',
      tagline: 'Food delivery in 30 minutes: place an order, pay, assign a delivery partner and track them live.',
      scale: [['Millions', 'orders per day'], ['~3×', 'dinner peak vs average'], ['Lakhs', 'delivery partners'], ['~5 s', 'location ping interval']],
      functional: ['Browse restaurants and menus near me', 'Place and pay for an order', 'Restaurant accepts and prepares', 'Assign a delivery partner', 'Track the order live with ETA'],
      nonfunctional: ['Never charge twice or lose an order', 'Menu loads under 300 ms', 'Survive dinner and rainy-day spikes', 'Tracking updates within a few seconds'],
      estimates: `orders: 3M/day ÷ 10⁵ ≈ <span class="r">30/s</span> avg, dinner peak ≈ <span class="r">100+/s</span><br>menu reads: ~30 per order ≈ <span class="r">1,000–3,000 reads/s</span> → cache menus<br>partner pings: 200K active × 1 every 5 s ≈ <span class="r">40,000 writes/s</span> → in-memory geo index<br>orders stored: 3M × 3 KB ≈ <span class="r">9 GB/day</span>`,
      api: `GET  /restaurants?lat&lng&cursor        → nearby, open now<br>POST /orders  {cart, address_id}  Idempotency-Key  → {order_id, pay_url}<br>GET  /orders/{id}                       → status + ETA<br>WS   /orders/{id}/track                  → live partner location`,
      nodes: {
        app: [90, 150, 'client', 'Customer app', '', 'Browses, orders, pays and watches the live map.'],
        partner: [90, 440, 'client', 'Partner app', 'delivery rider', 'Sends GPS pings, receives order offers, updates pickup and delivery.'],
        gw: [255, 290, 'gw', 'API gateway', 'auth · rate limit', 'Single front door. Validates tokens, rate limits, routes to services.'],
        menu: [255, 50, 'svc', 'Restaurant & menu', '+ Redis cache', 'Read-heavy. Menus are cached; when a restaurant marks an item out of stock, that cache key is deleted.'],
        order: [420, 150, 'svc', 'Order service', 'state machine', 'Owns the order lifecycle: PLACED → ACCEPTED → PREPARING → PICKED_UP → DELIVERED. Every transition is idempotent.'],
        odb: [585, 50, 'db', 'Orders DB', 'PostgreSQL', 'Source of truth for orders. Strong consistency matters here.'],
        pay: [420, 250, 'svc', 'Payment service', '', 'Creates payment intents with idempotency keys and handles gateway webhooks.'],
        pg: [585, 250, 'ext', 'Payment gateway', 'UPI · cards', 'External. Talks to banks and NPCI. Replies may be slow or lost, so status is confirmed via webhooks and polling.'],
        kafka: [585, 150, 'queue', 'Order events', 'Kafka', 'OrderPlaced, OrderAccepted, OrderPickedUp… Many services react without the Order service knowing them.'],
        rest: [750, 50, 'client', 'Restaurant app', 'tablet / POS', 'Rings for new orders; staff accept and set prep time.'],
        notif: [750, 150, 'svc', 'Notifications', 'push · SMS', 'Sends “order confirmed”, “partner arriving”.'],
        dispatch: [750, 250, 'svc', 'Dispatch', 'assignment', 'Chooses which partner gets which order, timing it so they reach the restaurant as food is ready.'],
        loc: [420, 470, 'svc', 'Location service', 'ingest pings', 'Receives tens of thousands of pings per second and updates the geo index.'],
        geo: [585, 470, 'cache', 'Geo index', 'Redis · in-memory', 'Partners filed by geohash cell. Answers “free partners within 3 km” in milliseconds.'],
        eta: [915, 250, 'ml', 'ETA model', 'prep + travel', 'Predicts food prep time and road travel time from history, traffic and weather.'],
        track: [255, 470, 'rt', 'Live tracking', 'WebSockets', 'Holds open connections to apps and pushes partner location and order offers.'],
      },
      edges: [['app', 'gw'], ['partner', 'gw'], ['gw', 'menu'], ['gw', 'order'], ['gw', 'loc'], ['order', 'odb'], ['order', 'pay'], ['pay', 'pg'], ['order', 'kafka'], ['kafka', 'rest'], ['kafka', 'notif'], ['kafka', 'dispatch'], ['dispatch', 'geo'], ['dispatch', 'eta'], ['loc', 'geo'], ['loc', 'track'], ['dispatch', 'track', true], ['track', 'app'], ['track', 'partner']],
      flows: [
        { name: 'Place order', steps: [
          ['app', 'gw', '<b>POST /orders</b> with cart, address and an <b>idempotency key</b>, so a retry on a flaky network can’t create two orders.'],
          ['gw', 'order', 'Token checked, rate limit passed, routed to Order service.'],
          ['order', 'odb', 'Insert order as <b>PENDING_PAYMENT</b>. Prices are re-checked on the server, never trusted from the app.'],
          ['order', 'pay', 'Create a payment for ₹420.'],
          ['pay', 'pg', 'UPI collect request or card charge.'],
          ['pg', 'pay', 'Success webhook (verified by signature).'],
          ['pay', 'order', 'Mark order <b>PLACED</b>.'],
          ['order', 'kafka', 'Publish <b>OrderPlaced</b> via the transactional outbox.'],
          ['kafka', 'rest', 'Restaurant tablet rings. Staff accept: prep time 15 min.'],
          ['kafka', 'notif', 'Customer gets “Order confirmed”.'],
        ] },
        { name: 'Assign partner', steps: [
          ['kafka', 'dispatch', '<b>OrderAccepted</b>, food ready in ~15 min.'],
          ['dispatch', 'geo', 'Free partners within 3 km of the restaurant?'],
          ['geo', 'dispatch', '18 candidates from nearby cells.'],
          ['dispatch', 'eta', 'Predict each one’s time to restaurant and to customer.'],
          ['eta', 'dispatch', 'Scores. Best plan may batch two orders from the same area.'],
          ['dispatch', 'track', 'Offer the order to the best partner.'],
          ['track', 'partner', '“New order: Meghana Foods, 1.2 km. Accept in 30 s.” If declined, offer to the next.'],
        ] },
        { name: 'Live tracking', steps: [
          ['partner', 'gw', 'GPS ping every few seconds.'],
          ['gw', 'loc', 'Routed to Location service.'],
          ['loc', 'geo', 'Move partner to new cell (used for future assignments).'],
          ['loc', 'track', 'Forward to the connection server watching order 9001.'],
          ['track', 'app', 'Customer’s map moves. ETA: 12 min.'],
        ] },
      ],
      dives: [
        ['Dispatch is the hard problem', '<p>The nearest free partner isn’t always best. Dispatch weighs prep time (don’t make partners wait at the restaurant), travel time, batching (one partner, two nearby orders), fairness of earnings, and re-assignment if a partner goes idle. It runs in short windows (say every few seconds) and solves a matching problem over all pending orders in a zone, not one order at a time.</p>'],
        ['Order state machine', '<p>Orders move through fixed states. Each transition is a conditional update: <code>UPDATE orders SET status=\'PICKED_UP\' WHERE id=9001 AND status=\'PREPARING\'</code>. Duplicate events or retries can’t move an order backwards or twice. Every transition is also an event on Kafka.</p>'],
        ['Surviving dinner peaks and rain', '<p>Traffic is predictable by hour, so autoscale ahead of 7–9 PM. When demand outruns partners (heavy rain), the system protects itself: shrink delivery radius, add surge fees, show longer ETAs, or temporarily stop accepting orders in a zone. A queue between order placement and downstream work absorbs bursts.</p>'],
        ['Menus and availability', '<p>Menus are read far more than written: cache them per restaurant. Item availability changes often during service, so those updates delete the cache key immediately. Restaurant “open/closed” status is pushed to the search index so closed places drop out of results.</p>'],
      ],
      tips: ['Split the problem: ordering (consistency), dispatch (optimization), tracking (real-time).', 'Compute the location ping rate early. It justifies an in-memory geo index.', 'Say “idempotency key” and “order state machine” for the payment and order flow.'],
      concepts: ['idempotency', 'message-queues', 'geospatial', 'realtime', 'caching', 'event-driven', 'microservices'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'zomato', name: 'Zomato', letter: 'Z', color: '#D62F44', levelLabel: 'Intermediate', after: 3, focus: 'Search, reviews, ratings',
      tagline: 'Find the best biryani near you: geo search, ranking, reviews and ratings that stay in sync.',
      scale: [['Lakhs', 'restaurants listed'], ['100 : 1', 'reads to writes'], ['< 200 ms', 'search p99 target'], ['Seconds', 'review → search delay']],
      functional: ['Search restaurants by dish, cuisine, name near me', 'Filter: rating, price, open now, veg', 'Restaurant page with menu and photos', 'Post reviews and ratings with photos'],
      nonfunctional: ['Fast search with typo tolerance', 'Ratings visible in search within seconds', 'Photos load fast on 4G', 'Resistant to fake reviews'],
      estimates: `searches: 10M/day ≈ <span class="r">115/s</span>, dinner peak ≈ <span class="r">500/s</span><br>restaurant page views ≈ <span class="r">2,000/s</span> peak → cache pages<br>reviews: 200K/day ≈ <span class="r">2/s</span> (tiny writes, heavy reads)<br>photos: 200K × 3 sizes × 200 KB ≈ <span class="r">120 GB/day</span> → object storage + CDN`,
      api: `GET  /search?q=biryani&lat&lng&filters&cursor<br>GET  /restaurants/{id}<br>POST /restaurants/{id}/reviews {rating, text, photo_ids}`,
      nodes: {
        app: [90, 260, 'client', 'App / web', '', 'Searches, browses restaurant pages and posts reviews.'],
        cdn: [255, 60, 'cdn', 'CDN', 'photos', 'Serves restaurant and dish photos from nearby edges.'],
        photos: [420, 60, 'store', 'Photo storage', 'S3-like', 'Original and resized photos. Uploaded via pre-signed URLs.'],
        rank: [585, 60, 'ml', 'Ranking', 'personalized', 'Re-orders search candidates using your past orders, rating, distance, price and offers.'],
        gw: [255, 260, 'gw', 'API gateway', '', 'Auth, rate limiting, routing.'],
        search: [420, 160, 'svc', 'Search service', '', 'Builds the query, calls the index, then the ranker.'],
        es: [585, 160, 'search', 'Search index', 'Elasticsearch', 'Inverted index over names, cuisines, dishes, with geo-distance filters and typo tolerance.'],
        indexer: [750, 160, 'svc', 'Indexer', '', 'Turns DB change events into search documents.'],
        rsvc: [420, 260, 'svc', 'Restaurant service', '', 'Restaurant pages, menus, hours. Cache-aside with Redis.'],
        rdb: [585, 260, 'db', 'Restaurants DB', 'MySQL', 'Source of truth for restaurant data and the current average rating.'],
        kafka: [750, 260, 'queue', 'Change events', 'Kafka + CDC', 'Change data capture streams every DB change to Kafka.'],
        cache: [255, 420, 'cache', 'Redis', 'page cache', 'Restaurant pages and menus. Deleted on edit.'],
        review: [420, 360, 'svc', 'Reviews service', '', 'Stores reviews, runs spam checks, emits ReviewPosted.'],
        rvdb: [585, 360, 'db', 'Reviews DB', 'sharded by restaurant', 'Reviews for one restaurant live together, so its review page is one shard read.'],
        agg: [750, 360, 'svc', 'Rating aggregator', '', 'Keeps a running sum and count per restaurant and writes the new average.'],
      },
      edges: [['app', 'cdn'], ['cdn', 'photos'], ['app', 'gw'], ['gw', 'search'], ['gw', 'rsvc'], ['gw', 'review'], ['search', 'es'], ['search', 'rank'], ['rsvc', 'rdb'], ['rsvc', 'cache'], ['review', 'rvdb'], ['review', 'kafka'], ['rdb', 'kafka'], ['kafka', 'indexer'], ['indexer', 'es'], ['kafka', 'agg'], ['agg', 'rdb']],
      flows: [
        { name: 'Search “biryani”', steps: [
          ['app', 'gw', '<b>GET /search?q=biryani</b> with your location.'],
          ['gw', 'search', 'Routed to Search service.'],
          ['search', 'es', 'Text match “biryani” (also “biriyani”, “dum biryani”), within 5 km, open now, filters.'],
          ['es', 'search', 'Top ~200 candidates in a few milliseconds.'],
          ['search', 'rank', 'Personalize: you often order Hyderabadi, you like 4.2+, offers apply.'],
          ['rank', 'search', 'Ranked list.'],
          ['search', 'gw', 'First 20 results with a cursor for the next page.'],
          ['gw', 'app', 'Results shown.'],
          ['app', 'cdn', 'Thumbnails load from the nearest CDN edge.'],
        ] },
        { name: 'Post a review', steps: [
          ['app', 'gw', '<b>POST /reviews</b>: 4 stars, text, photo ids (photos already uploaded with pre-signed URLs).'],
          ['gw', 'review', 'Routed to Reviews service.'],
          ['review', 'rvdb', 'Save the review after spam and abuse checks.'],
          ['review', 'kafka', 'Publish <b>ReviewPosted</b>.'],
          ['kafka', 'agg', 'Aggregator updates sum and count: no need to re-read every review.'],
          ['agg', 'rdb', 'New rating 4.3 (2.1K ratings) saved on the restaurant row.'],
          ['rdb', 'kafka', 'CDC emits the restaurant change.'],
          ['kafka', 'indexer', 'Indexer builds the updated search document.'],
          ['indexer', 'es', 'Search sees the new rating within seconds. Eventual consistency is fine here.'],
        ] },
      ],
      dives: [
        ['Why a separate search index', '<p>SQL <code>LIKE \'%biryani%\'</code> can’t use normal indexes and has no idea about typos, synonyms or relevance. An inverted index maps each word to the restaurants containing it, supports fuzzy matching and geo filters, and scores results. The database stays the source of truth; the index is a fast, rebuildable copy.</p>'],
        ['Keeping the index in sync', '<p>Dual-writing to DB and index from app code drifts on failures. Change data capture (Debezium reading the MySQL binlog into Kafka) gives a reliable stream of every change. If the index is ever corrupt, rebuild it from the DB.</p>'],
        ['Fair ratings', '<p>A place with one 5-star review shouldn’t outrank one with 4.6 over 3,000 reviews. Use a Bayesian average: blend each restaurant’s mean with the global mean, weighted by review count. Down-weight reviews from new or suspicious accounts, and from users who never ordered there.</p>'],
        ['Caching restaurant pages', '<p>Restaurant pages are read thousands of times per edit. Cache-aside in Redis with a TTL, delete the key on edits. Menu prices and availability may need shorter TTLs than photos and descriptions.</p>'],
      ],
      tips: ['Name the search engine and explain why the DB alone isn’t enough.', 'Show how writes flow into the index asynchronously (CDC).', 'Mention ranking signals and fake-review defenses.'],
      concepts: ['databases', 'indexing', 'caching', 'cdn', 'event-driven', 'object-storage', 'geospatial'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'uber', name: 'Uber', letter: 'U', color: '#1E2228', levelLabel: 'Advanced', after: 4, focus: 'Geo matching, surge, trip state',
      tagline: 'Match a rider with a nearby driver in seconds, price it fairly, and keep the trip state correct.',
      scale: [['Tens of M', 'trips per day'], ['~4 s', 'driver ping interval'], ['250K/s', 'pings for 1M online drivers'], ['H3', 'hexagonal geo cells']],
      functional: ['Rider sees nearby cars and a fare estimate', 'Request a ride and get matched', 'Driver accepts, navigates, completes trip', 'Live location both ways', 'Pay automatically at trip end'],
      nonfunctional: ['Match within a few seconds', 'A trip can never be accepted by two drivers', 'Highly available: no ride, no revenue', 'Work across hundreds of cities'],
      estimates: `online drivers: 1M × 1 ping / 4 s = <span class="r">250,000 location writes/s</span><br>ride requests: 25M/day ≈ <span class="r">300/s</span>, peak ≈ <span class="r">1,000/s</span><br>ping size 100 B × 250K/s ≈ <span class="r">25 MB/s</span> into Kafka (~2 TB/day)<br>live index: 1M drivers × 100 B = <span class="r">100 MB</span> → fits in memory, shard by city`,
      api: `GET  /estimate?pickup&drop       → fare, surge, ETA<br>POST /trips {pickup, drop}  Idempotency-Key<br>POST /drivers/me/location {lat, lng, heading}  (or over WebSocket)<br>POST /trips/{id}/accept | /start | /end`,
      nodes: {
        rider: [90, 150, 'client', 'Rider app', '', 'Requests rides and watches the car approach.'],
        driver: [90, 410, 'client', 'Driver app', '', 'Streams GPS, receives offers, runs the trip.'],
        gw: [255, 280, 'gw', 'API gateway', '', 'Auth, rate limits, routing. Region-aware.'],
        pricing: [915, 300, 'svc', 'Pricing', 'fare + surge', 'Base fare from route distance and time, times a surge multiplier for the pickup’s hex cell.'],
        trip: [420, 160, 'svc', 'Trip service', 'state machine', 'REQUESTED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED. Conditional updates prevent double accepts.'],
        tdb: [420, 50, 'db', 'Trips DB', 'sharded', 'Trip records sharded by trip id. Strongly consistent writes for state changes.'],
        match: [585, 160, 'svc', 'Matching', 'dispatch', 'Finds candidate drivers, ranks them by ETA, sends offers one at a time with a timeout.'],
        eta: [750, 160, 'svc', 'ETA & routing', 'road graph', 'Road-network travel times with live traffic. Nearest by air is often not nearest by road.'],
        pay: [585, 50, 'svc', 'Payments', '', 'Charges the saved method at trip end with an idempotency key.'],
        loc: [420, 380, 'svc', 'Location service', '', 'Ingests driver pings and keeps the live index current.'],
        geo: [585, 380, 'cache', 'Live geo index', 'H3 · in-memory', 'Drivers filed by hexagonal H3 cell, sharded by city. Lookups take milliseconds.'],
        kafka: [585, 470, 'queue', 'Location stream', 'Kafka', 'Every ping, kept for analytics, ETA training and surge.'],
        surge: [750, 470, 'job', 'Surge model', 'per hex cell', 'Compares demand (requests) and supply (free drivers) per cell every minute.'],
        push: [255, 480, 'rt', 'Realtime push', 'WebSocket', 'Pushes offers to drivers and driver location to riders.'],
      },
      edges: [['rider', 'gw'], ['driver', 'gw'], ['gw', 'pricing'], ['gw', 'trip'], ['gw', 'loc'], ['trip', 'tdb'], ['trip', 'match'], ['trip', 'pay'], ['match', 'geo'], ['match', 'eta'], ['loc', 'geo'], ['loc', 'kafka'], ['kafka', 'surge'], ['surge', 'pricing', true], ['trip', 'push', true], ['push', 'driver'], ['push', 'rider']],
      flows: [
        { name: 'Request & match', steps: [
          ['rider', 'gw', 'Pickup: Koramangala. Drop: airport. “How much?”'],
          ['gw', 'pricing', 'Route fare + surge for this H3 cell.'],
          ['pricing', 'gw', '₹740, surge 1.2×, car in 4 min.'],
          ['gw', 'trip', 'Rider confirms. Create trip <b>REQUESTED</b> (idempotency key prevents duplicates).'],
          ['trip', 'tdb', 'Persist the trip.'],
          ['trip', 'match', 'Find a driver.'],
          ['match', 'geo', 'Free drivers in the pickup cell and the ring of cells around it.'],
          ['geo', 'match', '14 candidates.'],
          ['match', 'eta', 'Road ETA for each to the pickup point.'],
          ['eta', 'match', 'Best: Ravi, 3 min by road.'],
          ['match', 'trip', 'Record the offer to Ravi on the trip.'],
          ['trip', 'push', 'Offer to Ravi with a 15 s timeout.'],
          ['push', 'driver', 'Driver taps <b>Accept</b>.'],
          ['driver', 'gw', 'POST /trips/42/accept'],
          ['gw', 'trip', '<code>UPDATE … SET status=ACCEPTED, driver=Ravi WHERE id=42 AND status=REQUESTED</code>. A second driver’s accept matches 0 rows.'],
          ['trip', 'push', 'Notify the rider.'],
          ['push', 'rider', '“Ravi, white Dzire, 3 min away.”'],
        ] },
        { name: 'Location & surge', steps: [
          ['driver', 'gw', 'GPS ping (lat, lng, heading, speed) every ~4 s.'],
          ['gw', 'loc', 'Routed by city to the right Location service shard.'],
          ['loc', 'geo', 'Move driver from cell A to cell B in memory.'],
          ['loc', 'kafka', 'Append the ping to the stream.'],
          ['kafka', 'surge', 'Count supply and demand per hex every minute.'],
          ['surge', 'pricing', 'Demand 3× supply near the stadium → surge 1.6× there.'],
        ] },
        { name: 'End trip & pay', steps: [
          ['driver', 'gw', 'Driver ends the trip.'],
          ['gw', 'trip', 'Status <b>COMPLETED</b>, 18.4 km, 41 min.'],
          ['trip', 'pay', 'Charge ₹752 with the trip id as idempotency key.'],
          ['pay', 'trip', 'Paid.'],
          ['trip', 'push', 'Send receipt.'],
          ['push', 'rider', 'Receipt and “Rate your driver”.'],
        ] },
      ],
      dives: [
        ['The live geo index', '<p>Drivers move constantly, so this index is in memory, sharded by city or region. Uber open-sourced <strong>H3</strong>, a hexagonal grid: every neighbor of a hexagon is equally far, which makes rings of search and per-cell surge math clean. A driver changing cells is a delete + insert in memory. History goes to Kafka, not to the index.</p>'],
        ['Preventing double booking of a driver or trip', '<p>Two riders could be offered the same driver, or two drivers could accept the same trip. Use <strong>conditional writes</strong> (compare-and-set on status), or a short lock per driver while an offer is outstanding. The losing side gets a clean “already taken” and matching moves on.</p>'],
        ['Matching is an optimization', '<p>Greedy “closest driver now” can be worse for everyone in a busy area. Batching requests over a short window (a second or two) and solving the assignment together lowers total wait time. Pool rides add route compatibility to the problem.</p>'],
        ['Surge pricing', '<p>Per hex cell, compare open requests and free drivers over the last few minutes. High demand raises the multiplier, which both reduces demand and pulls drivers in. Smooth changes over time and neighboring cells so prices don’t flicker.</p>'],
      ],
      tips: ['Lead with the location write rate. It shapes the whole design.', 'Explain the geo index and why it lives in memory.', 'Show how you prevent two drivers from accepting one trip.'],
      concepts: ['geospatial', 'realtime', 'sharding', 'consistency-models', 'idempotency', 'message-queues'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'netflix', name: 'Netflix', letter: 'N', color: '#C11119', levelLabel: 'Advanced', after: 5, focus: 'Video CDN, encoding, personalization',
      tagline: 'Stream video to hundreds of millions of screens without buffering, and pick what each person sees.',
      scale: [['300M+', 'paid memberships (2025)'], ['ISP-embedded', 'Open Connect CDN'], ['Dozens', 'encodes per title'], ['Many', 'microservices per screen']],
      functional: ['Personalized home screen', 'Play any title instantly on any device', 'Resume where you stopped', 'Studio uploads new titles'],
      nonfunctional: ['Start playback in ~2 s, no buffering', 'Adapt quality to bandwidth', 'Survive a whole AWS region failing', 'Keep bandwidth costs sane'],
      estimates: `peak viewers: say 20M at 5 Mbps ≈ <span class="r">100 Tbps</span> → must be served from caches inside ISPs<br>one 2-hr title × ~120 encodes × ~1 GB avg ≈ <span class="r">~100 TB per title</span> across formats (illustrative)<br>home screen: 100M opens/day ≈ <span class="r">1,200/s</span>, each fanning out to many services → cache precomputed rows`,
      api: `GET  /home?profile=…       → rows of titles + artwork URLs<br>POST /play {title_id, device_caps} → manifest with CDN URLs + DRM license<br>POST /heartbeat {position, bitrate, rebuffer}`,
      nodes: {
        device: [90, 160, 'client', 'TV / phone app', 'player', 'Picks bitrates, buffers ahead, reports playback quality.'],
        gw: [255, 160, 'gw', 'API gateway', 'Zuul', 'Edge routing to backend services, with filters for auth and traffic shaping.'],
        profile: [420, 60, 'svc', 'Profiles & auth', '', 'Who is watching, what plan they have, which devices are allowed.'],
        play: [420, 160, 'svc', 'Playback service', 'manifest + DRM', 'Checks entitlement, picks formats for the device, issues DRM license, asks Steering for URLs.'],
        steer: [585, 160, 'svc', 'Steering', 'pick best OCA', 'Knows which Open Connect appliances have the file and are healthy and close to the viewer’s ISP.'],
        recs: [420, 260, 'svc', 'Home & recommendations', '', 'Builds rows like “Because you watched…”, with personalized artwork.'],
        evc: [585, 260, 'cache', 'EVCache', 'memcached-based', 'Huge in-memory cache replicated across zones. Holds precomputed rows and user data.'],
        cass: [750, 260, 'db', 'Cassandra', 'viewing history', 'Write-heavy, multi-region. Viewing history, bookmarks, ratings.'],
        kafka: [255, 360, 'queue', 'Event stream', 'Kafka', 'Heartbeats and interactions from every device.'],
        ml: [750, 360, 'job', 'ML training', 'Spark etc.', 'Trains recommenders and measures streaming quality from events.'],
        oca: [90, 460, 'cdn', 'Open Connect', 'CDN inside ISPs', 'Netflix’s own cache servers placed inside internet providers. Most video bytes come from here.'],
        enc: [585, 460, 'job', 'Encoding farm', 'chunked, parallel', 'Splits masters into chunks and encodes many resolution/bitrate/codec variants in parallel.'],
        s3: [750, 460, 'store', 'S3', 'masters + outputs', 'Stores studio masters and encoded files.'],
        studio: [915, 460, 'ext', 'Studio', 'master files', 'Delivers very high quality source files for each title.'],
      },
      edges: [['device', 'gw'], ['gw', 'profile'], ['gw', 'play'], ['gw', 'recs'], ['play', 'steer'], ['recs', 'evc'], ['evc', 'cass'], ['gw', 'kafka'], ['kafka', 'ml'], ['ml', 'evc'], ['device', 'oca'], ['studio', 's3'], ['s3', 'enc'], ['enc', 'oca']],
      flows: [
        { name: 'Open the app', steps: [
          ['device', 'gw', '<b>GET /home</b> for profile “Vinay”.'],
          ['gw', 'recs', 'Build the home screen.'],
          ['recs', 'evc', 'Fetch precomputed rows and artwork choices for this profile.'],
          ['evc', 'recs', 'Cache hit in under a millisecond.'],
          ['recs', 'gw', '~40 rows of titles. If recs is down, a fallback serves popular titles instead of an error.'],
          ['gw', 'device', 'Home screen renders. Artwork loads from CDN.'],
        ] },
        { name: 'Press play', steps: [
          ['device', 'gw', '<b>POST /play</b>: title 80100172, device supports 4K, HDR, AV1.'],
          ['gw', 'play', 'Routed to Playback.'],
          ['play', 'steer', 'Which caches near this viewer’s ISP have these files and are healthy?'],
          ['steer', 'play', 'Ranked list of Open Connect URLs.'],
          ['play', 'gw', 'Manifest: bitrate ladder, URLs, DRM license.'],
          ['gw', 'device', 'Player starts at a modest bitrate to begin fast.'],
          ['device', 'oca', 'Fetches 2–4 s chunks from an OCA inside the viewer’s ISP. Steps quality up or down as bandwidth changes (adaptive bitrate).'],
        ] },
        { name: 'New title release', steps: [
          ['studio', 's3', 'Upload the master.'],
          ['s3', 'enc', 'Split into chunks; encode in parallel into many variants, tuned per title.'],
          ['enc', 'oca', 'Push files to OCAs overnight during off-peak hours, before anyone presses play.'],
        ] },
        { name: 'Viewing events', steps: [
          ['device', 'gw', 'Heartbeat: position 34:12, bitrate, rebuffer count.'],
          ['gw', 'play', 'Save resume point.'],
          ['gw', 'kafka', 'Heartbeats also stream into Kafka.'],
          ['kafka', 'ml', 'Train recommenders and spot quality problems by ISP.'],
          ['ml', 'evc', 'Refresh precomputed rows.'],
        ] },
      ],
      dives: [
        ['Open Connect: a push CDN inside ISPs', '<p>Video is most of Netflix’s traffic, so it built its own CDN. Open Connect Appliances sit inside ISP networks and internet exchanges. Popular files are pre-positioned overnight using predicted demand, so peak-hour traffic rarely crosses the wider internet. The control plane (AWS) decides which appliance serves each request.</p>'],
        ['Adaptive bitrate and encoding', '<p>Each title is encoded into a ladder of resolutions and bitrates, and in several codecs for different devices. The player measures throughput and buffer level and switches quality between chunks. Netflix tunes the ladder per title: a cartoon needs fewer bits than an action movie for the same quality.</p>'],
        ['Resilience by design', '<p>With many microservices, something is always failing. Netflix uses timeouts, fallbacks and bulkheads around every dependency, and practises failure on purpose with chaos engineering (Chaos Monkey randomly kills instances in production). It has run region evacuation drills, shifting traffic away from a whole AWS region.</p>'],
        ['Data stores', '<p>Cassandra for huge write-heavy data replicated across regions (viewing history). EVCache for low-latency reads of hot data. Kafka for event streams. Each store matches an access pattern.</p>'],
      ],
      tips: ['Separate control plane (APIs on cloud) from data plane (video bytes on CDN).', 'Explain adaptive bitrate in two sentences.', 'Mention fallbacks: the home screen must load even if recommendations fail.'],
      concepts: ['cdn', 'object-storage', 'resilience', 'microservices', 'caching', 'message-queues', 'observability'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'whatsapp', name: 'WhatsApp', letter: 'W', color: '#0F7A5A', levelLabel: 'Intermediate', after: 4, focus: 'Chat delivery, presence, receipts',
      tagline: 'Deliver messages instantly to online friends, safely to offline ones, with ✓ and ✓✓ that tell the truth.',
      scale: [['2B+', 'users'], ['100B+', 'messages / day (2020)'], ['~50', 'engineers for ~900M users (2015)'], ['E2E', 'encrypted by default']],
      functional: ['1:1 and group chat', 'Sent ✓, delivered ✓✓, read (blue) receipts', 'Offline delivery when the phone reconnects', 'Photos, video, voice notes', 'Last seen / online'],
      nonfunctional: ['Delivery under a second when online', 'Never lose or duplicate a message', 'Messages in order within a chat', 'Works on bad 2G/3G networks', 'Server cannot read messages'],
      estimates: `messages: 100B/day ÷ 10⁵ ≈ <span class="r">1.2M/s</span> avg, peak ≈ <span class="r">3M/s</span><br>online at once: ~500M connections ÷ ~1M per server ≈ <span class="r">500+ chat servers</span><br>offline queue: 100 B per message, kept only until delivered<br>media: goes to blob storage; message carries only an id and key`,
      api: `WS  connect (auth, device id)<br>→ {type: send, to, client_msg_id, ciphertext}<br>← {type: ack, server_msg_id}   ← {type: receipt, delivered|read}`,
      nodes: {
        alice: [90, 150, 'client', 'Alice’s phone', 'sender', 'Encrypts on device. Generates a unique message id so retries are de-duplicated.'],
        bob: [90, 420, 'client', 'Bob’s phone', 'receiver', 'Holds a WebSocket to some chat server when online.'],
        csA: [420, 150, 'rt', 'Chat server A', 'Alice connected', 'Keeps hundreds of thousands to millions of long-lived connections. WhatsApp famously used Erlang for this.'],
        csB: [420, 420, 'rt', 'Chat server B', 'Bob connected', 'Another connection server. Messages for Bob must be routed here.'],
        reg: [585, 285, 'cache', 'Session registry', 'user → server', 'Who is connected to which chat server right now. Updated on connect and disconnect.'],
        inbox: [585, 490, 'db', 'Offline inbox', 'per-user queue', 'Holds messages until the recipient’s device acknowledges them, then deletes them.'],
        groups: [750, 285, 'svc', 'Group service', 'member lists', 'Who is in each group. Used to fan out group messages.'],
        push: [750, 150, 'ext', 'Push service', 'APNs / FCM', 'Wakes a sleeping phone so it reconnects. Carries no message content.'],
        media: [585, 50, 'store', 'Media store', '+ CDN', 'Encrypted blobs. Only devices hold the keys.'],
      },
      edges: [['alice', 'csA'], ['bob', 'csB'], ['csA', 'reg'], ['csB', 'reg'], ['csA', 'csB'], ['csA', 'inbox'], ['csB', 'inbox'], ['csA', 'groups'], ['csA', 'push'], ['push', 'bob'], ['alice', 'media']],
      flows: [
        { name: 'Bob is online', steps: [
          ['alice', 'csA', 'Send <code>{to: bob, id: m1, ciphertext}</code> over Alice’s open WebSocket.'],
          ['csA', 'alice', 'Server has it: <b>✓ sent</b>.'],
          ['csA', 'reg', 'Where is Bob connected?'],
          ['reg', 'csA', 'Chat server B.'],
          ['csA', 'csB', 'Forward m1.'],
          ['csB', 'bob', 'Deliver over Bob’s socket.'],
          ['bob', 'csB', 'Bob’s phone acks m1.'],
          ['csB', 'csA', 'Delivery receipt for m1.'],
          ['csA', 'alice', '<b>✓✓ delivered</b>. When Bob opens the chat, a read receipt turns them blue the same way.'],
        ] },
        { name: 'Bob is offline', steps: [
          ['alice', 'csA', 'Send m2.'],
          ['csA', 'reg', 'Bob? Not connected.'],
          ['csA', 'inbox', 'Store m2 in Bob’s offline inbox.'],
          ['csA', 'push', 'Ask APNs/FCM to wake Bob’s phone (no content in the push).'],
          ['push', 'bob', 'Phone wakes up.'],
          ['bob', 'csB', 'Reconnects and asks for pending messages.'],
          ['csB', 'inbox', 'Fetch m2, deliver, then delete after Bob acks.'],
        ] },
        { name: 'Group message', steps: [
          ['alice', 'csA', 'Send to group “Family” (47 members).'],
          ['csA', 'groups', 'Member list?'],
          ['groups', 'csA', '47 members.'],
          ['csA', 'reg', 'Locate each member’s chat server.'],
          ['csA', 'csB', 'Fan out one copy per member’s server; offline members get inbox entries.'],
          ['csB', 'bob', 'Bob receives it.'],
        ] },
        { name: 'Send a photo', steps: [
          ['alice', 'media', 'Encrypt the photo on the phone and upload the blob.'],
          ['media', 'alice', 'Media id returned. The decryption key never leaves devices.'],
          ['alice', 'csA', 'A tiny message carries the media id and the key (itself encrypted for Bob).'],
          ['csA', 'csB', 'Routed like any message.'],
          ['csB', 'bob', 'Bob’s phone downloads the blob from the CDN and decrypts it.'],
        ] },
      ],
      dives: [
        ['Holding millions of connections', '<p>Each connected phone is a long-lived TCP/WebSocket connection, mostly idle. Erlang’s lightweight processes made it practical to hold very many per server. Heartbeats detect dead connections; the session registry is updated on connect and disconnect so routing stays correct.</p>'],
        ['Ordering and duplicates', '<p>The client attaches a unique id to every message, so a resend after a network drop is recognized and ignored. The server assigns a per-chat sequence so all devices show the same order. Delivery is at-least-once with de-duplication on the device: effectively once.</p>'],
        ['End-to-end encryption changes the design', '<p>With the Signal protocol, only devices hold keys. The server routes ciphertext it can’t read, so server-side search, spam scanning of content and message previews in pushes aren’t possible. Groups use sender keys so a message is encrypted once per sender rather than once per member.</p>'],
        ['Presence and last seen', '<p>Broadcasting every online/offline change to every contact is expensive. Presence is fetched when you open a chat and subscribed to only while it’s open, with throttling of rapid changes.</p>'],
      ],
      tips: ['Draw the connection layer and the user → server registry first.', 'Walk through both online and offline delivery, with receipts.', 'Mention client-generated ids for de-duplication.'],
      concepts: ['realtime', 'idempotency', 'databases', 'object-storage', 'consistent-hashing', 'cap-theorem'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'hotstar', name: 'Hotstar', letter: 'H', color: '#1C3FAA', levelLabel: 'Advanced', after: 5, focus: 'Live streaming at cricket scale',
      tagline: 'Stream an India match to tens of millions at once, when everyone joins in the same minute.',
      scale: [['25M+', 'concurrent viewers (2019 record)'], ['Minutes', 'for millions to join'], ['~4–6 s', 'video segments'], ['Multi-CDN', 'delivery']],
      functional: ['Watch live matches in many qualities and languages', 'Live score and “watching now” counter', 'Ads in breaks, personalized', 'Subscriptions and login'],
      nonfunctional: ['Video must not stop, even if other features do', 'Handle sudden 3–5× spikes (toss, a star walks in)', 'Low glass-to-glass delay', 'Work on weak mobile networks'],
      estimates: `25M viewers × 1.5 Mbps avg ≈ <span class="r">37 Tbps</span> → spread over several CDNs<br>segment requests: 25M ÷ 4 s ≈ <span class="r">6M requests/s</span> at the edge, for the same few files<br>heartbeats: 25M ÷ 60 s ≈ <span class="r">400K/s</span> → Kafka<br>API spike: 1M logins/min at toss ≈ <span class="r">17K/s</span> extra`,
      nodes: {
        feed: [90, 60, 'ext', 'Stadium feed', 'broadcast', 'The production feed arrives over fiber and satellite links, with backups.'],
        encoder: [255, 60, 'svc', 'Live encoders', 'ABR ladder', 'Encode in real time into many qualities and audio languages.'],
        pack: [420, 60, 'svc', 'Packager / origin', 'HLS · DASH', 'Cuts video into short segments and writes playlists. Shielded so CDNs don’t stampede it.'],
        cdn: [585, 60, 'cdn', 'Multi-CDN edges', '', 'Several CDN providers share traffic. If one struggles in a region, traffic shifts to another.'],
        viewers: [750, 160, 'client', 'Millions of viewers', 'phones · TVs', 'Players fetch the newest segment every few seconds and adapt quality.'],
        ads: [255, 160, 'svc', 'Ad insertion', 'server-side', 'Server-side ad insertion stitches ads into the stream so they play smoothly and resist ad blockers.'],
        forecast: [90, 280, 'ml', 'Traffic forecast', 'match + moments', 'Predicts concurrency from match importance, teams, time and moments like a star batting.'],
        scaler: [255, 280, 'job', 'Pre-warm scaling', 'ahead of spikes', 'Adds capacity well before the toss, because cloud scaling takes minutes but spikes take seconds.'],
        auth: [420, 280, 'svc', 'Auth & subscription', 'cached', 'Verifies the user can watch. Tokens cached heavily; degrades gracefully.'],
        gw: [585, 280, 'gw', 'API gateway', 'kill switches', 'Can switch off non-critical features (recommendations, comments) under load to protect video.'],
        kafka: [585, 400, 'queue', 'Heartbeats', 'Kafka', 'Each player reports every ~30–60 s: watching, quality, buffering.'],
        score: [750, 400, 'svc', 'Score + counter', 'HyperLogLog', 'Live score updates and “2.5 crore watching”, counted with HyperLogLog for unique devices.'],
        qoe: [915, 160, 'svc', 'Quality analytics', 'real-time', 'Buffering by city and ISP. Bad numbers trigger CDN traffic shifts.'],
      },
      edges: [['feed', 'encoder'], ['encoder', 'pack'], ['pack', 'cdn'], ['cdn', 'viewers'], ['ads', 'pack'], ['forecast', 'scaler'], ['scaler', 'auth'], ['viewers', 'gw'], ['gw', 'auth'], ['gw', 'kafka'], ['kafka', 'score'], ['kafka', 'qoe'], ['score', 'viewers'], ['qoe', 'cdn', true]],
      flows: [
        { name: 'Live video path', steps: [
          ['feed', 'encoder', 'Raw stadium feed arrives (with a backup path).'],
          ['encoder', 'pack', 'Encoded into ~6 qualities and several commentary languages.'],
          ['ads', 'pack', 'At an over break, personalized ads are stitched in server-side.'],
          ['pack', 'cdn', 'Segments published; CDN edges pull them through an origin shield.'],
          ['cdn', 'viewers', 'Every viewer fetches the same new segment within a few seconds. Weak 4G? The player drops to a lower quality instead of stopping.'],
        ] },
        { name: 'Toss-time spike', steps: [
          ['forecast', 'scaler', 'India vs Pakistan, 7:30 PM toss. Expect a huge jump in minutes.'],
          ['scaler', 'auth', 'Scale API and auth fleets 30–60 min early. Run at the predicted peak, not the current load.'],
          ['viewers', 'gw', 'Millions open the app within a minute.'],
          ['gw', 'auth', 'Check subscriptions using cached tokens.'],
          ['auth', 'gw', 'If a non-critical service struggles, the gateway flips a kill switch: hide recommendations, keep video and login.'],
        ] },
        { name: 'Watching-now counter', steps: [
          ['viewers', 'gw', 'Heartbeat every ~30–60 s.'],
          ['gw', 'kafka', 'Into the stream.'],
          ['kafka', 'score', 'Count unique devices in the last minute with HyperLogLog.'],
          ['score', 'viewers', '“2.5 crore watching” and live score.'],
          ['kafka', 'qoe', 'Buffering ratio by city and ISP.'],
          ['qoe', 'cdn', 'One CDN slow in Kolkata → shift that region’s traffic to another CDN.'],
        ] },
      ],
      dives: [
        ['Why live is harder than on-demand', '<p>On-demand files can be pre-positioned on caches days ahead. Live segments exist only seconds before everyone wants them, all at the same moment. CDNs must collapse identical requests into one origin fetch (request coalescing) and use an origin shield layer, or the origin melts.</p>'],
        ['Scale before the spike', '<p>Autoscaling reacts in minutes; a wicket brings millions in seconds. So capacity is planned from forecasts and pre-warmed, load tests replay realistic traffic beforehand, and the system is kept at headroom during the match. Hotstar engineers have talked publicly about this “scale ahead” approach.</p>'],
        ['Graceful degradation', '<p>Rank features by importance: video > login > score > everything else. Under stress, turn off the bottom of the list with kill switches and serve static fallbacks. A viewer doesn’t mind missing recommendations; they mind a frozen stream at the last over.</p>'],
        ['Delay vs stability', '<p>Shorter segments reduce delay behind the live action but mean more requests and less buffer to ride out network hiccups. Typical HLS/DASH live delay is tens of seconds; low-latency variants reduce it with partial segments.</p>'],
      ],
      tips: ['Separate the video data path (CDN) from the API path (gateway).', 'Talk about pre-warming and forecasts, not just autoscaling.', 'Say which features you’d turn off first under load.'],
      concepts: ['cdn', 'scaling', 'resilience', 'bloom-filters', 'message-queues', 'observability', 'latency'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'irctc', name: 'IRCTC Tatkal', letter: 'R', color: '#2A4F8F', levelLabel: 'Advanced', after: 4, focus: 'Booking under extreme contention',
      tagline: 'Lakhs of people hit “Book” at 10:00:00 for a few hundred seats. Be fast, fair and never double-sell.',
      scale: [['10:00 AM', 'Tatkal opens (AC)'], ['Lakhs', 'users in the first minute'], ['Hundreds', 'seats per train'], ['0', 'double bookings allowed']],
      functional: ['Search trains and live availability', 'Book seats with passenger details', 'Pay and get a PNR', 'Waitlist when seats run out'],
      nonfunctional: ['Seat inventory strongly consistent', 'Fair: first in line, first served', 'Keep bots out', 'Stay up through the 10:00 spike'],
      estimates: `500K users within 60 s ≈ <span class="r">8,000+ booking attempts/s</span> at the start<br>availability checks are ~10× that → serve from cache<br>a popular train-date-class has maybe <span class="r">~100 Tatkal seats</span>: extreme contention on one counter<br>payments: bank round trips of seconds → hold seats while paying`,
      nodes: {
        users: [90, 260, 'client', 'Lakhs of users', '10:00:00 AM', 'All arrive in the same few seconds.'],
        edge: [255, 140, 'cdn', 'CDN + WAF', 'bot defense', 'Static pages from the edge. Web firewall, CAPTCHA and bot scoring filter scripts.'],
        wait: [255, 380, 'svc', 'Waiting room', 'fair queue', 'Gives each user a signed position token and lets them in at the rate the backend can handle.'],
        gw: [420, 260, 'gw', 'API gateway', 'rate limits', 'Per-account and per-IP limits. Only admitted tokens pass.'],
        search: [585, 140, 'svc', 'Availability', 'read path', 'Serves seat counts from cache. Good enough for browsing; the booking step checks for real.'],
        cache: [750, 140, 'cache', 'Redis', 'counts, ~1 s fresh', 'Availability counts refreshed every second or so.'],
        book: [585, 260, 'svc', 'Booking service', '', 'Holds seats, takes payment, confirms. Idempotent per booking attempt.'],
        inv: [750, 260, 'db', 'Seat inventory', 'strongly consistent', 'Partitioned by train + date + class. Atomic decrement or row lock per partition.'],
        pay: [585, 380, 'svc', 'Payment service', '', 'Collects payment and tracks pending states.'],
        bank: [750, 380, 'ext', 'Bank / UPI', '', 'External and slow. May time out.'],
        kafka: [420, 420, 'queue', 'Booking events', 'Kafka', 'TicketBooked, HoldExpired, Cancelled.'],
        notify: [255, 490, 'svc', 'Ticket delivery', 'SMS · email', 'Sends the PNR and e-ticket.'],
      },
      edges: [['users', 'edge'], ['edge', 'wait'], ['wait', 'gw'], ['gw', 'search'], ['search', 'cache'], ['gw', 'book'], ['book', 'inv'], ['book', 'pay'], ['pay', 'bank'], ['book', 'kafka'], ['kafka', 'notify']],
      flows: [
        { name: 'The 10:00 rush', steps: [
          ['users', 'edge', 'Pages load from the CDN. Bots get CAPTCHAs or blocked.'],
          ['edge', 'wait', 'Too many at once: “You are #48,213. Estimated wait 2 min.” Position is a signed token.'],
          ['wait', 'gw', 'Users admitted at the rate the booking backend can safely handle.'],
          ['gw', 'search', 'Rajdhani 12951, 3A, Tatkal availability?'],
          ['search', 'cache', 'Read the cached count.'],
          ['cache', 'search', '“AVAILABLE 34” (approximate, refreshed every second).'],
        ] },
        { name: 'Book a seat', steps: [
          ['gw', 'book', 'Book 2 berths with an idempotency key.'],
          ['book', 'inv', 'Atomically hold 2 seats for 10 minutes: <code>UPDATE … SET free = free - 2 WHERE free >= 2</code>.'],
          ['inv', 'book', 'HELD. (If 0 rows changed: waitlist offered instead.)'],
          ['book', 'pay', 'Collect ₹2,450.'],
          ['pay', 'bank', 'UPI / net banking.'],
          ['bank', 'pay', 'Success.'],
          ['pay', 'book', 'Payment confirmed.'],
          ['book', 'inv', 'Convert hold to BOOKED, assign berth numbers.'],
          ['book', 'kafka', 'Publish TicketBooked.'],
          ['kafka', 'notify', 'PNR by SMS and email.'],
        ] },
        { name: 'Payment times out', steps: [
          ['book', 'pay', 'Collect payment.'],
          ['pay', 'bank', 'Request sent.'],
          ['bank', 'pay', 'No answer in time. Status is PENDING, not FAILED: the money may have moved.'],
          ['pay', 'book', 'Keep the hold while checking status with the bank.'],
          ['book', 'inv', 'If unpaid when the 10-minute hold expires, release seats to the pool. If the bank later confirms a debit, refund automatically.'],
          ['book', 'kafka', 'Publish HoldExpired so counts and caches update.'],
        ] },
      ],
      dives: [
        ['The hot-row problem', '<p>Thousands of requests fight over one counter: “free seats for train X, date Y, class 3A”. A naive row lock serializes them all. Options: keep the counter in Redis with an atomic decrement (fast) and persist the result; split the seats into several sub-counters (buckets) and pick one at random; or queue booking requests per train and process them in order with a single worker. All keep correctness while raising throughput.</p>'],
        ['A waiting room is fairness plus protection', '<p>Instead of letting everyone hammer the backend (and most get errors), give each arrival a queue position and admit people at a steady rate. Users get honest feedback, the backend stays healthy, and refresh-spamming doesn’t help because the token holds your place.</p>'],
        ['Reservations with expiry', '<p>A hold is a temporary claim with a TTL. Payment happens while the seat is held. A background job (or Redis key expiry events) releases expired holds. This pattern also fits flash sales, concert tickets and hotel rooms.</p>'],
        ['Bots and agents', '<p>Automated booking is a big problem for scarce inventory. Defenses include CAPTCHA at key steps, limits per account and IP, verified accounts, device fingerprinting, and detecting inhuman form-fill speed.</p>'],
      ],
      tips: ['Name the contention: one hot counter per train-date-class.', 'Separate approximate availability (cache) from exact booking (strong consistency).', 'Use holds with expiry and handle payment timeouts as pending.'],
      concepts: ['cap-theorem', 'consistency-models', 'rate-limiting', 'idempotency', 'caching', 'message-queues', 'security'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'upi', name: 'UPI Payments', letter: '₹', color: '#2F7D3A', levelLabel: 'Advanced', after: 4, focus: 'Idempotency, ledgers, reconciliation',
      tagline: 'Pay ₹250 at a chai stall from a PhonePe or GPay-style app. Every rupee must end up exactly where it should.',
      scale: [['~20B', 'UPI txns / month (2025)'], ['4+', 'parties per payment'], ['Seconds', 'end-to-end'], ['100%', 'must reconcile']],
      functional: ['Pay by UPI ID, phone number or QR', 'Collect requests', 'Instant success/failure with history', 'Payee notified (sound box!)'],
      nonfunctional: ['Never double-debit; never lose money', 'Handle bank timeouts honestly', 'Peaks on festival days and salary days', 'Secure: PIN never exposed'],
      estimates: `20B txns/month ÷ 2.6M s ≈ <span class="r">7,700 txns/s</span> nationally on average, peaks several × higher<br>one big app at ~45% share ≈ <span class="r">3,500/s</span> avg, ~<span class="r">10K/s</span> peak<br>txn record ~1 KB → ~<span class="r">9 TB/month</span> for that app, kept for years (audit)`,
      nodes: {
        payer: [90, 160, 'client', 'Payer app', 'PSP app', 'Encrypts the UPI PIN on the device using the bank’s public key. Device is bound to the SIM.'],
        psp: [255, 160, 'svc', 'PSP backend', 'app’s servers', 'Creates the transaction with a unique id, runs risk checks, talks to NPCI.'],
        tdb: [255, 50, 'db', 'Transactions DB', 'append-only', 'Every state change recorded. Strong consistency, replicated, never edited in place.'],
        risk: [420, 50, 'ml', 'Risk engine', '', 'Velocity limits, device checks, known fraud patterns.'],
        npci: [420, 270, 'ext', 'NPCI UPI switch', 'central router', 'Routes between banks and apps. Defines the message formats and timeouts.'],
        pbank: [585, 160, 'ext', 'Payer’s bank', 'remitter', 'Verifies the PIN and debits the account.'],
        ebank: [585, 380, 'ext', 'Payee’s bank', 'beneficiary', 'Credits the merchant’s account.'],
        epsp: [255, 400, 'svc', 'Payee app backend', 'merchant PSP', 'Gets the credit notification and alerts the merchant.'],
        payee: [90, 400, 'client', 'Chai stall', 'sound box', '“₹250 received.”'],
        recon: [420, 470, 'job', 'Reconciliation', 'status + files', 'Matches every transaction across app, NPCI and bank records. Resolves pending ones.'],
      },
      edges: [['payer', 'psp'], ['psp', 'tdb'], ['psp', 'risk'], ['psp', 'npci'], ['npci', 'pbank'], ['npci', 'ebank'], ['npci', 'epsp'], ['epsp', 'payee'], ['recon', 'ebank'], ['recon', 'psp']],
      flows: [
        { name: 'Pay ₹250', steps: [
          ['payer', 'psp', 'Scan QR, enter amount, enter UPI PIN (encrypted on device).'],
          ['psp', 'tdb', 'Create txn <b>PENDING</b> with a unique transaction id. Retries reuse this id: no double payment.'],
          ['psp', 'risk', 'Velocity, device and amount checks.'],
          ['risk', 'psp', 'OK.'],
          ['psp', 'npci', 'Pay request.'],
          ['npci', 'pbank', 'Debit ₹250 after verifying the PIN.'],
          ['pbank', 'npci', 'Debited.'],
          ['npci', 'ebank', 'Credit ₹250.'],
          ['ebank', 'npci', 'Credited.'],
          ['npci', 'psp', 'SUCCESS.'],
          ['psp', 'tdb', 'Record SUCCESS (a new row, not an edit).'],
          ['psp', 'payer', '✓ Paid. Green tick.'],
          ['npci', 'epsp', 'Credit notification to the merchant’s app.'],
          ['epsp', 'payee', 'Sound box: “₹250 received.”'],
        ] },
        { name: 'Timeout & reconcile', steps: [
          ['psp', 'npci', 'Pay request.'],
          ['npci', 'pbank', 'Debit.'],
          ['pbank', 'npci', 'Debited… but the reply is delayed.'],
          ['npci', 'psp', 'Timeout. Status is <b>PENDING</b>. Never guess “failed”: the money may have moved.'],
          ['psp', 'payer', '“Payment pending. Don’t pay again; we’ll update you.”'],
          ['recon', 'ebank', 'Status check by transaction id, and settlement files later.'],
          ['recon', 'psp', 'Final answer: SUCCESS (notify both sides) or FAILED with automatic reversal of any debit.'],
        ] },
      ],
      dives: [
        ['Idempotency everywhere', '<p>Every hop carries the same unique transaction id. If the app retries, the PSP finds the existing transaction. If NPCI or a bank sees the id again, it returns the earlier result instead of debiting twice. A unique constraint on the id in the database is the last line of defense.</p>'],
        ['A ledger, not a balance column', '<p>Money systems record immutable entries (debit X, credit Y) and derive balances from them, often with double-entry bookkeeping where every transaction’s entries sum to zero. Nothing is updated in place, so the full history is auditable and errors can be traced.</p>'],
        ['Pending is a real state', '<p>Distributed calls can end in “I don’t know”. Model that honestly: PENDING, then resolve with status-check APIs, timeouts and reconciliation against settlement files. Banks automatically reverse debits that never completed. The user interface must not encourage paying twice.</p>'],
        ['Peak days', '<p>Festival sales, month-start salary days and big events cause sharp peaks. Apps scale stateless tiers ahead of time, shed non-essential work (offers, rewards calculation) to queues, and protect the critical payment path with strict timeouts and circuit breakers toward slow banks.</p>'],
      ],
      tips: ['Lead with idempotency and the PENDING state.', 'Say “append-only ledger” and “reconciliation”.', 'Mention that banks and NPCI are external and can be slow: timeouts and breakers per bank.'],
      concepts: ['idempotency', 'consistency-models', 'cap-theorem', 'resilience', 'event-driven', 'security', 'replication'],
    },
    /* ------------------------------------------------------------ */
    {
      id: 'instagram', name: 'Instagram', letter: 'I', color: '#B0307E', levelLabel: 'Advanced', after: 5, focus: 'Feeds, fan-out, media',
      tagline: 'Post a photo, and show each of 2B people a fast, ranked feed, including posts from celebrities with 100M+ followers.',
      scale: [['2B+', 'monthly users'], ['Read ≫ write', 'feed views vs posts'], ['100M+', 'followers for top accounts'], ['< 500 ms', 'feed load target']],
      functional: ['Upload photos and videos', 'Follow people', 'Home feed of followed accounts, ranked', 'Like and comment'],
      nonfunctional: ['Feed loads fast on mobile', 'Uploads survive bad networks', 'New posts reach followers within seconds to minutes', 'Highly available; slight staleness is fine'],
      estimates: `posts: 100M/day ≈ <span class="r">1,200/s</span><br>feed opens: 2B × 10/day ÷ 10⁵ ≈ <span class="r">200K/s</span> → must be precomputed<br>fan-out: avg 200 followers × 1,200 posts/s ≈ <span class="r">240K feed writes/s</span><br>media: 100M × 2 MB × 3 sizes ≈ <span class="r">600 TB/day</span> → object storage + CDN`,
      api: `POST /media/upload-url → pre-signed URL<br>POST /posts {media_id, caption}<br>GET  /feed?cursor=…   → 20 posts<br>POST /posts/{id}/like`,
      nodes: {
        app: [90, 260, 'client', 'App', '', 'Uploads media, reads the feed.'],
        cdn: [255, 60, 'cdn', 'CDN', 'images · video', 'Serves every image and video from edges near users.'],
        s3: [585, 60, 'store', 'Object storage', 'media', 'Original and resized media.'],
        workers: [750, 60, 'job', 'Media workers', 'resize · transcode', 'Make several sizes, strip metadata, check for abuse.'],
        gw: [255, 260, 'gw', 'API gateway', '', 'Auth, routing, rate limits.'],
        post: [420, 160, 'svc', 'Post service', '', 'Issues upload URLs, creates posts.'],
        pdb: [585, 160, 'db', 'Posts DB', 'sharded by user', 'Posts sharded by author id, with time-sortable ids.'],
        kafka: [750, 160, 'queue', 'PostCreated', 'Kafka', 'Every new post becomes an event.'],
        fan: [750, 260, 'job', 'Fan-out workers', '', 'Push new post ids into followers’ feeds, skipping celebrities and inactive users.'],
        graph: [915, 260, 'db', 'Social graph', 'followers', 'Who follows whom. Huge, read-heavy.'],
        feed: [420, 260, 'svc', 'Feed service', '', 'Assembles the feed: pre-built list + celebrity pulls → ranking.'],
        fcache: [585, 260, 'cache', 'Feed cache', 'Redis list per user', 'The latest few hundred post ids for each active user.'],
        rank: [420, 380, 'ml', 'Ranking', '', 'Scores candidates by predicted interest. Returns the top N.'],
        hot: [585, 380, 'cache', 'Celebrity posts', 'hot cache', 'Recent posts of high-follower accounts, pulled at read time.'],
      },
      edges: [['app', 'cdn'], ['cdn', 's3'], ['app', 'gw'], ['gw', 'post'], ['post', 's3'], ['s3', 'workers'], ['workers', 'pdb'], ['post', 'pdb'], ['pdb', 'kafka'], ['kafka', 'fan'], ['fan', 'graph'], ['fan', 'fcache'], ['gw', 'feed'], ['feed', 'fcache'], ['feed', 'rank'], ['feed', 'hot']],
      flows: [
        { name: 'Post a photo', steps: [
          ['app', 'gw', 'Ask for an upload URL.'],
          ['gw', 'post', 'Routed to Post service.'],
          ['post', 's3', 'Create a pre-signed upload URL (valid for minutes).'],
          ['app', 'cdn', 'Upload bytes to the nearest edge, which forwards to storage. App servers never touch them.'],
          ['cdn', 's3', 'Stored.'],
          ['s3', 'workers', 'Upload event: make 3 sizes, check content.'],
          ['workers', 'pdb', 'Mark the post READY with its media URLs.'],
          ['pdb', 'kafka', 'Publish PostCreated.'],
          ['kafka', 'fan', 'Fan-out worker picks it up.'],
          ['fan', 'graph', 'Followers of @vinay? 2,300.'],
          ['graph', 'fan', 'List returned in pages.'],
          ['fan', 'fcache', 'Prepend the post id to 2,300 feed lists. (A celebrity post would skip this step.)'],
        ] },
        { name: 'Open the feed', steps: [
          ['app', 'gw', '<b>GET /feed</b>'],
          ['gw', 'feed', 'Routed to Feed service.'],
          ['feed', 'fcache', 'My pre-built list: ~500 post ids.'],
          ['feed', 'hot', 'Plus recent posts from the 6 celebrities I follow (pulled, not pushed).'],
          ['feed', 'rank', 'Score ~600 candidates.'],
          ['rank', 'feed', 'Top 20 in order.'],
          ['feed', 'gw', 'Post metadata and media URLs, with a cursor.'],
          ['gw', 'app', 'Feed renders.'],
          ['app', 'cdn', 'Images stream in from the CDN.'],
        ] },
      ],
      dives: [
        ['Hybrid fan-out', '<p>Push to followers for normal accounts; pull at read time for accounts above a follower threshold. Also skip pushing to users inactive for weeks and rebuild their feed when they return. This keeps fan-out writes bounded no matter how famous someone is. Try it in the <a href="#t-news-feeds">fan-out simulation</a>.</p>'],
        ['Time-sortable ids across shards', '<p>Instagram’s engineering blog described ids made of a timestamp, a logical shard id and a sequence number, generated inside sharded PostgreSQL. Ids sort by time (great for feeds and cursors) and say which shard holds the row. Twitter’s Snowflake uses a similar layout.</p>'],
        ['Media pipeline', '<p>Uploads use pre-signed URLs and resumable chunks. Processing is asynchronous: resize, transcode video into adaptive bitrates, generate blur previews. The post is visible only after media is ready.</p>'],
        ['Ranking', '<p>Fan-out produces candidates; a ranking model orders them using signals like your past interactions with the author, post type, recency and predicted engagement. A cheap first-pass ranker trims candidates before an expensive model scores the rest.</p>'],
      ],
      tips: ['Do the read vs write math: feed reads dominate, so precompute.', 'Bring up the celebrity problem yourself and solve it with hybrid fan-out.', 'Keep media off app servers with pre-signed URLs.'],
      concepts: ['news-feeds', 'object-storage', 'cdn', 'sharding', 'caching', 'message-queues'],
    },
  ];

  /* ---------------- Diagram engine ---------------- */
  BP.renderDiagram = function (host, c) {
    const NW = 140, NH = 52;
    const svg = s('svg', { viewBox: '0 0 1000 520', role: 'img', 'aria-label': c.name + ' architecture diagram' });
    const E = s('g'), P = s('g'), N = s('g');
    svg.append(E, P, N);
    const stage = h('div', { class: 'sim-stage' }, svg);
    const side = h('div', { class: 'diagram-side' });
    host.append(h('div', { class: 'diagram-wrap' }, stage, side));
    const pk = BP.packetLayer(P);
    const ctr = (k) => [c.nodes[k][0], c.nodes[k][1]];
    function clip(a, b) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const sc = Math.min(dx ? (NW / 2 + 4) / Math.abs(dx) : Infinity, dy ? (NH / 2 + 4) / Math.abs(dy) : Infinity);
      return [a[0] + dx * sc, a[1] + dy * sc];
    }
    const edgeEls = {};
    c.edges.forEach(([a, b, dash]) => {
      if (!c.nodes[a] || !c.nodes[b]) { console.warn('bad edge', c.id, a, b); return; }
      const p1 = clip(ctr(a), ctr(b)), p2 = clip(ctr(b), ctr(a));
      const l = s('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: 'wire' + (dash ? ' dash' : '') });
      E.append(l);
      edgeEls[a + '|' + b] = edgeEls[b + '|' + a] = { l, dash };
    });
    const nodeEls = {};
    let selected = null;
    Object.entries(c.nodes).forEach(([k, [x, y, type, label, sub]]) => {
      const [tag, col] = TYPES[type] || TYPES.svc;
      const g = s('g', { class: 'clickable', transform: `translate(${x - NW / 2},${y - NH / 2})`, tabindex: 0, role: 'button', 'aria-label': label });
      const r = s('rect', { width: NW, height: NH, rx: 9, class: 'n-box' });
      g.append(r, s('rect', { x: 0, y: 8, width: 4, height: NH - 16, rx: 2, style: 'fill:' + col }));
      g.append(s('text', { x: 12, y: 14, class: 'n-tag', text: tag }));
      g.append(s('text', { x: 12, y: sub ? 31 : 36, class: 'n-label', text: label, style: 'font-size:12.5px' }));
      if (sub) g.append(s('text', { x: 12, y: 45, class: 'n-sub', text: sub, style: 'font-size:10.5px' }));
      g.addEventListener('click', () => select(k));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(k); } });
      N.append(g);
      nodeEls[k] = r;
    });

    const info = h('div', { class: 'node-info' });
    function select(k) {
      selected = k;
      const [, , type, label, sub, txt] = c.nodes[k];
      Object.entries(nodeEls).forEach(([kk, r]) => r.classList.toggle('sel', kk === k));
      info.innerHTML = '';
      info.append(h('div', { class: 'eyebrow' }, (TYPES[type] || TYPES.svc)[0]), h('h4', null, label + (sub ? ' · ' + sub : '')), h('p', null, txt || ''));
    }

    let fi = 0, si = 0, timer = null;
    const stepBox = h('div', { class: 'flow-step' });
    const dots = h('div', { class: 'progress-dots' });
    const prevB = BP.button('← Back', () => { stop(); go(si - 1); });
    const nextB = BP.button('Next →', () => { stop(); go(si + 1); }, 'primary');
    const playB = BP.button('▶ Play all', () => { if (timer) stop(); else play(); });
    function stop() { if (timer) { clearInterval(timer); timer = null; } playB.textContent = '▶ Play all'; }
    function play() {
      if (si >= c.flows[fi].steps.length - 1) go(0);
      playB.textContent = '❚❚ Pause';
      timer = setInterval(() => { if (si >= c.flows[fi].steps.length - 1) { stop(); return; } go(si + 1); }, 2300);
      BP.onDispose(() => clearInterval(timer));
    }
    function go(i) {
      const f = c.flows[fi];
      si = BP.clamp(i, 0, f.steps.length - 1);
      const [a, b, txt] = f.steps[si];
      Object.values(edgeEls).forEach(({ l, dash }) => l.setAttribute('class', 'wire' + (dash ? ' dash' : '')));
      Object.entries(nodeEls).forEach(([k, r]) => { r.classList.remove('hot'); if (k === a || k === b) r.classList.add('hot'); });
      const e = edgeEls[a + '|' + b];
      if (e) e.l.setAttribute('class', 'wire hot');
      else console.warn('no edge for step', c.id, a, b);
      pk.clear();
      if (c.nodes[a] && c.nodes[b]) pk.send([clip(ctr(a), ctr(b)), clip(ctr(b), ctr(a))], { cls: 'amber', r: 7, dur: 0.9 });
      stepBox.innerHTML = `<span class="n">Step ${si + 1} of ${f.steps.length} · ${c.nodes[a][3]} → ${c.nodes[b][3]}</span>${txt}`;
      dots.innerHTML = '';
      f.steps.forEach((_, j) => dots.append(h('i', { class: j <= si ? 'on' : '' })));
      prevB.disabled = si === 0; nextB.disabled = si === f.steps.length - 1;
    }
    const picker = BP.seg(c.flows.map((f, i) => [i, f.name]), 0, (v) => { stop(); fi = v; go(0); });
    side.append(h('div', { class: 'flow-main' }, h('div', null, h('div', { class: 'eyebrow', style: { marginBottom: '6px' } }, 'Request flows'), picker),
      dots, stepBox, h('div', { class: 'flow-nav' }, prevB, nextB, playB)), info);
    info.append(h('p', { class: 'muted', style: { fontSize: '14px', margin: 0 } }, 'Click any box to see what it does.'));
    go(0);
  };

  /* ---------------- Case page ---------------- */
  BP.renderCase = function (page, c) {
    page.append(h('div', { class: 'case-hero' },
      h('div', { class: 'mono-badge', style: { background: c.color } }, c.letter),
      h('div', null, h('div', { class: 'eyebrow' }, 'Case study', h('i', { class: 'dotsep' }), c.levelLabel, h('i', { class: 'dotsep' }), c.focus), h('h1', null, c.name))));
    page.append(h('p', { class: 'lead' }, c.tagline));
    page.append(h('div', { class: 'scale-strip' }, c.scale.map(([v, l]) => h('div', null, h('b', null, v), h('span', null, l)))));
    page.append(h('div', { class: 'callout tip' }, h('span', { class: 'ico' }, 'Try first'), h('p', null, 'Before scrolling, take 5 minutes and sketch your own design on paper. Then compare. You learn far more from the gaps you find.')));

    page.append(h('h2', null, '1 · Requirements'), h('div', { class: 'req-grid' },
      h('div', { class: 'req' }, h('h4', null, 'Functional · what it does'), h('ul', null, c.functional.map((x) => h('li', null, x)))),
      h('div', { class: 'req' }, h('h4', null, 'Non-functional · how well'), h('ul', null, c.nonfunctional.map((x) => h('li', null, x))))));
    page.append(h('h2', null, '2 · Back-of-envelope'), h('div', { class: 'calc', html: c.estimates }));
    if (c.api) page.append(h('h2', null, '3 · Core API'), h('div', { class: 'calc', html: c.api }));
    page.append(h('h2', null, (c.api ? '4' : '3') + ' · Architecture'),
      h('p', { class: 'prose muted' }, 'Pick a flow and press Next to follow one request through the system. Click any box for details.'));
    BP.renderDiagram(page, c);
    page.append(h('p', { class: 'muted', style: { fontSize: '13.5px', maxWidth: '76ch' } }, NOTE));
    page.append(h('h2', null, (c.api ? '5' : '4') + ' · Deep dives'));
    c.dives.forEach(([t, body], i) => page.append(h('details', { class: 'dive', open: i === 0 ? true : null }, h('summary', null, t), h('div', { class: 'body', html: body }))));
    page.append(h('div', { class: 'callout tip' }, h('span', { class: 'ico' }, 'Interview'), h('div', null, h('b', { class: 't' }, 'If this comes up in an interview'), h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, c.tips.map((t) => h('li', null, t))))));
    page.append(h('h2', null, 'Concepts used here'), h('div', { class: 'chips' }, c.concepts.map((id) => {
      const t = BP.TOPICS.find((x) => x.id === id);
      return t ? h('a', { class: 'chip', href: '#t-' + t.id }, (BP.isDone(t.id) ? '✓ ' : '') + t.title) : null;
    })));
    const key = 'c-' + c.id;
    const btn = h('button', { class: 'btn ' + (BP.isDone(key) ? '' : 'primary'), type: 'button' }, BP.isDone(key) ? '✓ Completed · undo' : 'Mark case study complete');
    btn.addEventListener('click', () => {
      BP.setDone(key, !BP.isDone(key));
      btn.className = 'btn ' + (BP.isDone(key) ? '' : 'primary');
      btn.textContent = BP.isDone(key) ? '✓ Completed · undo' : 'Mark case study complete';
      if (BP.isDone(key)) BP.toast('Case study complete');
    });
    page.append(h('div', { class: 'done-bar' }, h('span', { class: 'muted' }, 'Could you explain this design out loud in 10 minutes?'), btn));
    const i = BP.CASES.indexOf(c), prev = BP.CASES[i - 1], next = BP.CASES[i + 1];
    page.append(h('nav', { class: 'pn' },
      prev ? h('a', { href: '#c-' + prev.id }, h('small', null, '← Previous case'), h('b', null, prev.name)) : h('span'),
      next ? h('a', { class: 'next', href: '#c-' + next.id }, h('small', null, 'Next case →'), h('b', null, next.name)) : h('a', { class: 'next', href: '#interview' }, h('small', null, 'Next →'), h('b', null, 'Mock interview'))));
    page.append(BP.foot());
  };
})();
