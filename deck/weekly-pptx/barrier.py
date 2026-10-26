import re
def nz(v): return '' if v is None or (isinstance(v,float)) or str(v)=='nan' else str(v)
# Order matters: the first rule that fits wins.
def barrier(x):
    d=nz(x['Detail Pembahasan']).lower(); rs=nz(x['Alasan customer tidak tertarik']).lower()
    if re.search(r'tempo|\bcod\b',d+' '+rs): return 'Payment terms (COD / tempo)'
    if 'terikat' in rs: return 'Tied to a KUD or agent'
    if 'belum ada kebutuhan' in rs or re.search(r'stok di gudangnya|jika ada kebutuhan',d): return 'No need yet'
    if re.search(r'(tokling|toko keliling).*(kapan|tidak ada yang kearah)|kapan tokling|belum ada jadwal',d) or 'datang lebih lama' in rs or 'antrian' in d: return 'No mobile-shop route or long wait'
    if 'harga mahal' in rs or re.search(r'ongkir|pengiriman ke|pengantaran',d): return 'Price or shipping cost'
    if re.search(r'gudang|jemput',d): return 'Wants warehouse pick-up'
    if re.search(r'orang ?tua|suami',d) and 'topaz' not in d: return 'Decision by family'
    if 'topaz' in d: return 'Topaz rules or documents'
    return 'Just asking / catalogue sent'
