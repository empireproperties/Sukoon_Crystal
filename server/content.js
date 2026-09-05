/* Static page content, seeded into the `pages` collection on first boot.
 *
 * Stored in the database rather than hardcoded in the client so the wording can
 * be edited from the admin without a redeploy. Seeding only fills in pages that
 * do not already exist, so an edit made in the admin is never overwritten.
 *
 * `reviewed: false` marks copy that Sukoon has NOT yet signed off. The Terms of
 * Service came from the owner verbatim; the other policies are drafts written
 * to a sensible Indian-retail default and must be read before the store opens.
 */

const section = (heading, body, list) => ({ heading, body: [].concat(body || []), list: list || null });

export const PAGES = [
  /* ------------------------------------------------------------------ about */
  {
    handle: 'about',
    title: 'About Us',
    reviewed: true,
    sections: [
      section(null, [
        "Since we began in 2024, we've helped over 1,000 people worldwide find more positivity and success.",
        'We sell beautiful, 100% real Gemstone items like Wellness bracelets, Zodiac bracelets, authentic Rudraksha, and our Special Sukoon collection. Each piece is made with a special purpose in mind.',
        'If you want something unique, we can create a Custom bracelet just for you, and you can even schedule a personal call with our founder for guidance.',
      ]),
      section('Founder', [
        'Namaste, I’m Swati Khanna, the founder of Sukoon CrystalSolutions.',
        "For over 10 years, I have been blessed to guide people on their life's path as a certified astrologer and numerologist. My journey began with a simple purpose: to help you find the clarity, balance, and harmony you deserve.",
        'I believe that the stars and numbers hold a unique map for each of us — our cosmic blueprint. I help you read this map and turn its wisdom into soulful healing through personalized crystal remedies.',
        'My goal is simple: to help you find ‘Sukoon’ (deep peace) in your life’s journey.',
      ]),
    ],
  },

  /* -------------------------------------------------------- terms (verbatim) */
  {
    handle: 'terms-of-service',
    title: 'Terms of Service',
    updated: 'September 2025',
    reviewed: true,
    sections: [
      section('1. Acceptance of Terms',
        'By accessing and using Sukoon CrystalSolutions’ website (the "Site") and purchasing our products ("Products"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Site or purchase our Products.'),
      section('2. Products and Services',
        'Sukoon CrystalSolutions offers handcrafted gemstone items including wellness bracelets, zodiac bracelets, authentic Rudraksha, and our Special Sukoon collection. We also provide custom bracelet creation services and personalized consultations with our founder.'),
      section('Product Descriptions',
        'We strive to accurately describe all our Products. However, we do not warrant that Product descriptions are entirely accurate, complete, reliable, current, or error-free. Natural gemstones may have variations in color, pattern, and appearance.'),
      section('Consultation Services',
        'Our spiritual consultations are provided for guidance purposes only. They are not intended to replace professional medical, legal, or financial advice. You are solely responsible for any decisions you make based on information received during consultations.'),
      section('3. Orders and Payment',
        'All orders are subject to product availability and acceptance. We reserve the right to refuse any order for any reason.'),
      section('Pricing',
        'Prices for our Products are subject to change without notice. We reserve the right to modify or discontinue Products without notice.'),
      section('Payment',
        'We accept various payment methods as indicated at checkout. You agree to provide current, complete, and accurate purchase information for all purchases.'),
      section('4. Custom Orders',
        'Custom bracelet orders require special attention and care. Once a custom order is confirmed and production has begun, it cannot be cancelled as these pieces are specifically created according to your requirements.'),
      section('5. Spiritual Nature of Products',
        'Our Products are created with positive intention and spiritual purpose. However, we make no guarantees regarding specific outcomes, results, or effects from using our Products. Individual experiences may vary.'),
      section('6. User Conduct', 'You agree not to use the Site or Products:', [
        'For any unlawful purpose',
        'To solicit others to perform or participate in any unlawful acts',
        'To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances',
        'To infringe upon or violate our intellectual property rights or the intellectual property rights of others',
        'To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability',
      ]),
      section('7. Intellectual Property',
        'All content included on this Site, such as text, graphics, logos, images, and product descriptions, is the property of Sukoon CrystalSolutions and protected by international copyright laws.'),
      section('8. Disclaimer of Warranties',
        'We do not guarantee, represent, or warrant that your use of our Products or Site will be uninterrupted, timely, secure, or error-free. We do not warrant that the results that may be obtained from the use of the Products will be accurate or reliable.'),
      section('9. Limitation of Liability',
        'In no case shall Sukoon CrystalSolutions, our directors, officers, employees, affiliates, agents, contractors, interns, suppliers, service providers, or licensors be liable for any injury, loss, claim, or any direct, indirect, incidental, punitive, special, or consequential damages of any kind.'),
      section('10. Indemnification',
        'You agree to indemnify, defend, and hold harmless Sukoon CrystalSolutions from any claim or demand, including reasonable attorneys’ fees, made by any third-party due to or arising out of your breach of these Terms of Service.'),
      section('11. Changes to Terms of Service',
        'We reserve the right to update, change, or replace any part of these Terms of Service by posting updates and changes to our Site. It is your responsibility to check our Site periodically for changes.'),
      section('12. Governing Law',
        'These Terms of Service and any separate agreements whereby we provide you Services shall be governed by and construed in accordance with the laws of India.'),
      section('13. Contact Information',
        'Questions about the Terms of Service should be sent to us at sukoon.crystalsolutions@gmail.com.'),
    ],
  },

  /* ------------------------------------------------------- shipping (draft) */
  {
    handle: 'shipping-policy',
    title: 'Shipping Policy',
    updated: 'September 2025',
    reviewed: false,
    sections: [
      section('Where we ship',
        'We dispatch across India from our studio in Meerut, Uttar Pradesh. For international orders, please write to us at sukoon.crystalsolutions@gmail.com before placing the order so we can confirm availability and charges.'),
      section('Dispatch time',
        'Ready-to-ship pieces leave our studio within 1–3 business days. Every order is cleansed and energised before it is packed, which is why we do not dispatch the same day. Custom bracelets take 5–7 business days to make before dispatch.'),
      section('Delivery time',
        'Once dispatched, delivery usually takes 3–7 business days depending on your location. Remote pin codes may take longer. You will receive a tracking number by SMS and email as soon as your parcel leaves us.'),
      section('Shipping charges',
        'Shipping is free on all prepaid orders above ₹999. Below that, a flat charge is shown at checkout before you pay.'),
      section('Cash on delivery',
        'Cash on delivery is available on eligible pin codes for orders of ₹500 or more. You pay a ₹200 advance online when you place the order and the balance to the courier on delivery. The ₹200 is part of your order total, not an extra charge — an ₹800 order means ₹200 online and ₹600 at the door.'),
      section('Delays outside our control',
        'Festivals, weather, strikes and courier backlogs can delay a parcel. We will always help you trace it, but we cannot guarantee delivery dates affected by these.'),
      section('Wrong address or failed delivery',
        'Please check your address and phone number carefully. If a parcel returns to us because the address was incorrect or nobody was available across three delivery attempts, we will contact you to arrange redelivery at an additional shipping charge.'),
      section('Questions',
        'Write to sukoon.crystalsolutions@gmail.com or call +91 90122 57555 and we will help.'),
    ],
  },

  /* --------------------------------------------------------- returns (draft) */
  {
    handle: 'return-refund-policy',
    title: 'Return & Refund Policy',
    updated: 'September 2025',
    reviewed: false,
    sections: [
      section('Our promise',
        'Every piece is checked by hand before it is packed. If something reaches you broken, defective or not what you ordered, we will make it right.'),
      section('Return window',
        'Tell us within 7 days of delivery. Raise the request from your account under My Orders, or write to sukoon.crystalsolutions@gmail.com with your order number and photographs of the issue.'),
      section('What we accept', 'We accept returns and replacements for:', [
        'Items that arrived broken or damaged in transit',
        'Manufacturing defects, such as a broken thread or a loose bead',
        'The wrong item or the wrong size being delivered',
      ]),
      section('What we cannot accept', 'For reasons of hygiene, authenticity and the nature of the products, we cannot accept:', [
        'Custom or personalised bracelets made to your specification',
        'Items that have been worn, used, altered or damaged after delivery',
        'Items returned without their original packaging, tags and any certificate supplied',
        'Requests raised more than 7 days after delivery',
        'A change of mind about the stone, colour or natural variation — gemstones are natural and vary in colour, pattern and inclusion, and this is not a defect',
        'Consultation fees, once the consultation has taken place',
      ]),
      section('How a return works', null, [
        'Raise the request with your order number and clear photographs.',
        'We respond within 2 business days with a decision.',
        'If approved, we arrange a reverse pickup where the courier serves your pin code, or ask you to self-ship.',
        'Once we receive and inspect the item, we confirm your replacement or refund.',
      ]),
      section('Refunds',
        'Approved refunds are issued to the original payment method within 7–10 business days of us receiving the item. For cash-on-delivery orders we refund by bank transfer to an account you nominate. Shipping charges already paid are not refundable unless the fault was ours.'),
      section('Replacements',
        'Where you would rather have a replacement than a refund, we will send the same piece if it is in stock, or hold your credit until it is back.'),
      section('Cancellations',
        'An order can be cancelled any time before it is dispatched, at no charge. Once dispatched it must be handled as a return. Custom orders cannot be cancelled once production has begun.'),
      section('Questions',
        'Write to sukoon.crystalsolutions@gmail.com or call +91 90122 57555.'),
    ],
  },

  /* --------------------------------------------------------- privacy (draft) */
  {
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    updated: 'September 2025',
    reviewed: false,
    sections: [
      section('What this covers',
        'This policy explains what Sukoon CrystalSolutions collects when you use our website, why we collect it, and what choices you have. We collect as little as we can, and we do not sell your data to anybody.'),
      section('What we collect', null, [
        'Details you give us: name, email address, phone number and delivery address when you place an order or book a consultation.',
        'Order information: what you bought, when, and the status of the delivery.',
        'Consultation notes: any details you choose to share for an astrology or numerology reading.',
        'Technical information: pages visited and approximate traffic source, used only to understand what people find useful.',
      ]),
      section('What we do not collect',
        'We never see or store your full card number, UPI PIN or bank credentials. Online payments are handled entirely by our payment provider, and only the result of a payment reaches us.'),
      section('Why we use it', null, [
        'To take, pack and deliver your order, and to update you about it.',
        'To answer your questions and provide support.',
        'To carry out a consultation you have booked.',
        'To meet our legal and tax obligations.',
      ]),
      section('Who we share it with',
        'Only those who need it to complete your order: our courier partner for delivery, and our payment provider for payment. They may use your details only for that purpose. We do not sell, rent or trade your personal information.'),
      section('How long we keep it',
        'Order and invoice records are kept as long as tax law requires. Consultation notes are kept only while they are useful to you, and are deleted on request.'),
      section('Your choices', null, [
        'Ask for a copy of what we hold about you.',
        'Ask us to correct anything that is wrong.',
        'Ask us to delete your account and personal data, except records we must keep by law.',
        'Unsubscribe from our messages at any time.',
      ]),
      section('Cookies',
        'We use a small amount of browser storage to remember your cart and your display preferences. It stays in your browser and is not used to track you across other websites.'),
      section('Contact',
        'For any privacy question, or to exercise any of the choices above, write to sukoon.crystalsolutions@gmail.com.'),
    ],
  },

  /* ------------------------------------------------------------- faq (draft) */
  {
    handle: 'faq',
    title: 'Frequently Asked Questions',
    updated: 'September 2025',
    reviewed: false,
    sections: [
      section('Are the stones genuine?',
        'Yes. Every stone is sourced directly and checked by hand — never dyed glass. Natural stones vary in colour, pattern and inclusion, so your piece will not look identical to the photograph, and that is the mark of a real stone rather than a fault.'),
      section('Are the bracelets energised before dispatch?',
        'Yes. Each piece is cleansed in salt and charged with mantra at our Meerut studio before it is packed. This is why we do not dispatch the same day.'),
      section('How do I choose the right bracelet?',
        'Shop by what you are working on — calm, focus, protection, prosperity — or by your zodiac sign. If you would like guidance, book a consultation with Swati and she will recommend a remedy for your chart.'),
      section('Can I get a custom bracelet?',
        'Yes. Tell us what you need and we will design it for you. Custom pieces take 5–7 business days to make, and cannot be cancelled once production has begun.'),
      section('How should I care for my bracelet?',
        'Keep it away from perfume, soap and chlorinated water, take it off before you bathe or sleep, and wipe it gently with a soft dry cloth. Cleanse it under moonlight or with incense when it feels heavy.'),
      section('Do you offer cash on delivery?',
        'Yes, on eligible pin codes, for orders of ₹500 or more. You pay ₹200 online when you place the order and the rest to the courier on delivery. The ₹200 comes off your total rather than being added to it.'),
      section('How long will delivery take?',
        'Orders leave our studio in 1–3 business days and usually arrive 3–7 business days after that. You will get a tracking number as soon as it is dispatched.'),
      section('What if my piece arrives broken?',
        'Tell us within 7 days with photographs and we will replace or refund it. Read the full Return & Refund Policy for details.'),
      section('What happens in a consultation?',
        'Swati reads your birth chart and numbers, talks through what you are facing, and recommends crystal remedies suited to you. Consultations are for guidance and are not a substitute for medical, legal or financial advice.'),
      section('Still need help?',
        'Write to sukoon.crystalsolutions@gmail.com or call +91 90122 57555.'),
    ],
  },
];

/** Pages the client links to but that must never 404. */
export const PAGE_HANDLES = PAGES.map((p) => p.handle);
