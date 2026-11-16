/* GO+MART Shift System — ຂໍ້ມູນຫຼັກ (Master data)
 * ແກ້ໄຂໄຟລ໌ນີ້ເພື່ອປັບລາຍການໃຫ້ກົງກັບຮ້ານຂອງທ່ານ
 * ທີ່ມາ: ຟອມເຈ້ຍ 6 ໃບ (v2) ຂອງ GO+MART
 */
const CONFIG = {
  version: '1.5.1',

  /* ຄ່າຕັ້ງຕົ້ນ — ປ່ຽນໄດ້ໃນໜ້າ "ຕັ້ງຄ່າ" ຂອງແອັບ */
  defaults: {
    branches: ['ສາຂາ 1'],
    shifts: [
      { key: 'morning', label: 'ກະເຊົ້າ', start: '06:30', end: '14:30' },
      { key: 'afternoon', label: 'ກະບ່າຍ', start: '14:30', end: '22:00' }
    ],
    /* ສ່ວນຕ່າງເງິນສົດທີ່ຍອມຮັບໄດ້ (ກີບ) — ເກີນນີ້ຕ້ອງຂຽນເຫດຜົນ */
    cashVarianceLimit: 10000,
    /* ສົ່ງລາຍງານຊ້າກວ່າເວລາເປີດກະເທົ່ານີ້ = ຖືວ່າຊ້າ (ນາທີ) */
    lateMinutes: 15,
    /* ຈໍານວນໂຊນທີ່ຕ້ອງກວດຕໍ່ 1 ກະ */
    zonesPerShift: 3
  },

  /* ປະເພດໃບເງິນກີບ — ຈາກ ຟອມມອບ-ຮັບເງິນສົດ */
  denominations: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500],

  /* ຈຸດຖ່າຍຮູບບັງຄັບ — 8 ຈຸດ
   * open  = ຕ້ອງຖ່າຍຕອນເປີດກະ
   * close = ຕ້ອງຖ່າຍຕອນປິດກະ */
  checkpoints: [
    { key: 'storefront', label: 'ໜ້າຮ້ານ / ທາງເຂົ້າ', hint: 'ຖ່າຍໃຫ້ເຫັນປ້າຍ ແລະ ປະຕູແກ້ວ', open: true, close: true },
    { key: 'counter', label: 'ເຄົາເຕີ້ + ລິ້ນຊັກເງິນ', hint: 'ຕ້ອງເປີດລິ້ນຊັກໃຫ້ເຫັນຂ້າງໃນ', open: true, close: true },
    { key: 'zreport', label: 'ໃບສະຫຼຸບຍອດ POS (Z-Report)', hint: 'ຖ່າຍໃກ້ໆ ໃຫ້ອ່ານຕົວເລກອອກ', open: false, close: true },
    { key: 'cash', label: 'ເງິນສົດທີ່ນັບໄດ້', hint: 'ວາງເງິນແຍກເປັນປະເພດໃບ', open: false, close: true },
    { key: 'fridge', label: 'ຕູ້ແຊ + ໜ້າຈໍອຸນຫະພູມ', hint: 'ຕ້ອງເຫັນຕົວເລກອຸນຫະພູມ', open: true, close: true },
    { key: 'controlled', label: 'ຊັ້ນສິນຄ້າຄວບຄຸມ (ເຫຼົ້າ, ຢາສູບ)', hint: 'ຖ່າຍໃຫ້ເຫັນທັງຊັ້ນ', open: true, close: true },
    { key: 'vari', label: 'ຕູ້ນໍ້າ Vari / ສິນຄ້າໜ້າຮ້ານ', hint: '', open: true, close: false },
    { key: 'backarea', label: 'ຖັງຂີ້ເຫຍື້ອ / ຫ້ອງນໍ້າ / ທ້າຍຮ້ານ', hint: '', open: true, close: true }
  ],

  /* ເຄື່ອງໃຊ້ 11 ລາຍການ — ຈາກ ຟອມກວດເຄື່ອງໃຊ້ (v2)
   * min/max = ເກນອຸນຫະພູມ °C ; null = ບໍ່ຕ້ອງວັດ */
  equipment: [
    { key: 'pos',        label: 'ເຄື່ອງ POS',                      min: null, max: null, note: 'ບໍ່ມີເກນອຸນຫະພູມ' },
    { key: 'fridge4',    label: 'ຕູ້ເຢັນ 4 ປະຕູ',                  min: 2,   max: 5,   note: '' },
    { key: 'fridgeopen', label: 'ຕູ້ເຢັນຝາເປີດ',                   min: 2,   max: 4,   note: '' },
    { key: 'icebox',     label: 'ຕູ້ນໍ້າກ້ອນ',                     min: null, max: null, note: 'ລໍຖ້າຜູ້ຈັດການກໍານົດເກນ' },
    { key: 'icecream',   label: 'ຕູ້ກະແລມ',                        min: -25, max: -18, note: '' },
    { key: 'pepsi',      label: 'ຕູ້ແຊແປັບຊີ 2 ປະຕູ',              min: 2,   max: 7,   note: '' },
    { key: 'vari',       label: 'ຕູ້ແຊນໍ້າວາລີ',                   min: 2,   max: 7,   note: '' },
    { key: 'hotdog',     label: 'ເຄື່ອງປີ້ງຮອດດອກ',                min: null, max: null, note: 'ຕາມ SOP ການນໍາໃຊ້' },
    { key: 'microwave',  label: 'ໄມໂຄເວບ',                         min: null, max: null, note: 'ຕາມ SOP ການນໍາໃຊ້' },
    { key: 'warmer',     label: 'ເຄື່ອງອຸ່ນອາຫານແບບຕູ້ໂຊ',         min: null, max: null, note: 'ຕາມ SOP ການນໍາໃຊ້' },
    { key: 'waterpot',   label: 'ໝໍ້ນໍ້າຮ້ອນ',                     min: null, max: null, note: 'ຕາມ SOP ການນໍາໃຊ້' }
  ],

  /* Checklist ໜ້າຮ້ານ 4 ໝວດ — ຈາກ Checklist ສໍາລັບພະນັກງານໜ້າຮ້ານ (v2) */
  checklist: [
    { section: '1. ການແຕ່ງກາຍ ແລະ ຄວາມສະອາດສ່ວນຕົວ', items: [
      { key: 'uniform',  label: 'ໃສ່ເຄື່ອງແບບພະນັກງານໜ້າຮ້ານ' },
      { key: 'badge',    label: 'ຕິດປ້າຍພະນັກງານ' },
      { key: 'grooming', label: 'ຜົມ, ໜ້າ, ເລັບສະອາດ' },
      { key: 'shoes',    label: 'ເກີບສຸພາບ' }
    ]},
    { section: '2. ອຸປະກອນ ແລະ ເຄື່ອງໃຊ້ໃນຮ້ານ', items: [
      { key: 'posok',    label: 'ເຄື່ອງ POS ເປີດ / ປິດ ແລະ ກວດສະພາບໄດ້ປົກກະຕິ' },
      { key: 'float',    label: 'ກວດເງິນທອນຕັ້ງຕົ້ນດ້ວຍ ຟອມ Cash Count' },
      { key: 'bags',     label: 'ຖົງຢາງ, ຖົງເຈ້ຍ ແລະ ສິ່ງຫຸ້ມຫໍ່ອື່ນໆ ມີພຽງພໍ' },
      { key: 'appliances', label: 'ກວດເຄື່ອງໃຊ້ໄຟຟ້າຄົບ (ຂຽນອຸນຫະພູມເປັນຕົວເລກ)' }
    ]},
    { section: '3. ຄວາມສະອາດຂອງຮ້ານ', items: [
      { key: 'front',    label: 'ໜ້າຮ້ານ / ປະຕູແກ້ວ / ກະຈົກ' },
      { key: 'floor',    label: 'ພື້ນຮ້ານ ບໍ່ມີຂີ້ເຫຍື້ອ' },
      { key: 'shelves',  label: 'ຊັ້ນວາງເຄື່ອງສະອາດ ບໍ່ມີຂີ້ຝຸ່ນ' },
      { key: 'bin',      label: 'ຖັງຂີ້ເຫຍື້ອບໍ່ເຕັມ' },
      { key: 'smell',    label: 'ກິ່ນໃນຮ້ານບໍ່ອັບ' },
      { key: 'toilet',   label: 'ຫ້ອງນໍ້າສະອາດ ແລະ ມີອຸປະກອນຄົບ' }
    ]},
    { section: '4. ສິນຄ້າ (ພາບລວມ — ລາຍລະອຽດໃຫ້ໃຊ້ໜ້າ "ກວດນັບໂຊນ")', items: [
      { key: 'full',     label: 'ສິນຄ້າຄົບຊັ້ນ ບໍ່ມີຊ່ອງຫວ່າງ' },
      { key: 'fifo',     label: 'ສິນຄ້າຢູ່ຖືກບ່ອນ ແລະ ສິນຄ້າໃກ້ໝົດອາຍຸຢູ່ທາງໜ້າ (FIFO)' },
      { key: 'noexpired',label: 'ບໍ່ມີສິນຄ້າໝົດອາຍຸຢູ່ໃນຊັ້ນ' },
      { key: 'nodamage', label: 'ບໍ່ມີສິນຄ້າເສຍຫາຍ / ແຕກ' },
      { key: 'pricetag', label: 'ປ້າຍລາຄາຕິດຄົບ ແລະ ຖືກຕ້ອງ' }
    ]}
  ],

  /* ກວດນັບສິນຄ້າ 10 ຂໍ້ — ຈາກ ຟອມກວດນັບສິນຄ້າປະຈໍາວັນ (v2) */
  stockChecks: [
    { key: 'onshelf',    label: 'ສິນຄ້າຢູ່ໃນຊັ້ນ' },
    { key: 'instock',    label: 'ບໍ່ Out of stock' },
    { key: 'facing',     label: 'Facing ຄົບ / ຈັດຕົງ' },
    { key: 'tags',       label: 'ມີປ້າຍລາຄາຄົບ' },
    { key: 'pricematch', label: 'ລາຄາໜ້າຊັ້ນຕົງກັບ POS' },
    { key: 'notexpired', label: 'ບໍ່ໝົດອາຍຸ' },
    { key: 'fifo',       label: 'FIFO ຖືກຕ້ອງ (ເກົ່າຢູ່ໜ້າ)' },
    { key: 'packaging',  label: 'Packaging ບໍ່ຈີກ / ບໍ່ແຕກ' },
    { key: 'clean',      label: 'Shelf ສະອາດ' },
    { key: 'controlled', label: 'ສິນຄ້າຄວບຄຸມ (ເຫຼົ້າ, ຢາສູບ) ຄົບຕາມຈໍານວນ' }
  ],

  /* ໂຊນສິນຄ້າ — ແກ້ໄດ້ໃນໜ້າ "ຕັ້ງຄ່າ" */
  zones: [
    'ເຄື່ອງດື່ມ', 'ຂະໜົມ', 'ເຫຼົ້າ - ເບຍ', 'ຢາສູບ',
    'ຂອງໃຊ້ປະຈໍາວັນ', 'ອາຫານແຊ່ແຂງ', 'ກະແລມ', 'ອາຫານພ້ອມຮັບປະທານ'
  ],

  /* ວິທີຈັດການສິນຄ້າໝົດອາຍຸ / ເສຍຫາຍ — ລະຫັດ 1-5 ຈາກຟອມ v2 */
  disposalActions: [
    { code: 1, label: 'ຈັດ Promotion / ລົດລາຄາ' },
    { code: 2, label: 'ຍ້າຍໄປຈຸດຂາຍພິເສດ (Near-expiry shelf)' },
    { code: 3, label: 'Return ໃຫ້ Supplier' },
    { code: 4, label: 'ຖອນອອກຈາກການຂາຍ (ລໍຖ້າທໍາລາຍ)' },
    { code: 5, label: 'ອື່ນໆ' }
  ],

  /* ສາເຫດສ່ວນຕ່າງເງິນສົດ */
  varianceReasons: [
    'ທອນເງິນຜິດ',
    'ບໍ່ໄດ້ບັນທຶກການຂາຍໃນ POS',
    'ຮັບເງິນປອມ',
    'ຍັງຫາສາເຫດບໍ່ໄດ້',
    'ອື່ນໆ'
  ],

  issueStatuses: ['ເປີດ', 'ກໍາລັງແກ້', 'ແກ້ແລ້ວ']
};
