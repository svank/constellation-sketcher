"""A thrown-together script to build a usable, JS-accessible catalog of
constellation lines and the stars (both in the constellation and background
stars) near the constellation. An important part is projecting the star's
coordinates into (x,y) values. The script could use optimization so it doesn't
runs through every Hipparchos star so many times, but this script won't be run
very often."""

import json
import multiprocessing

from astropy.coordinates import SkyCoord
import astropy.units as u
from astropy.wcs import WCS
import numpy as np

# This controls which background stars will be included in the catalog.
# Constellation stars will always be included
VMAG_CUTOFF = 6

# Background stars will be included in a square box that is this fraction
# larger than the square bounding box centered on the constellation
PADDING_FRACTION = .2

# Constant to ensure stars within constellations aren't pruned prematurely.
# Does not affect behavior of VMAG_CUTOFF
DIMMEST_CONSTELLATION_STAR = 6.7

name_dat = open("constellation_names.eng.fab").readlines()
# Maps constellation abbreviations to full names
name_map = {line.split()[0]: line.split('"')[1] for line in name_dat}

line_dat = open("constellationship.fab").readlines()

star_dat = open("hipparchos_catalog.tsv").readlines()
# Will map Hipparchos IDs to (RA, Dec, Vmag)
star_map = {}
for line in star_dat[43:-1]:
    try:
        id, RA, dec, Vmag = line.split(";")
    except ValueError:
        continue
    try:
        Vmag = float(Vmag)
    except ValueError:
        Vmag = 9999
    
    # Cut out stars we won't use
    if Vmag > max(DIMMEST_CONSTELLATION_STAR, VMAG_CUTOFF):
        continue
    
    # Convert RA to floating-point degrees
    h, m, s = RA.split(" ")
    h = int(h) + int(m) / 60 + float(s) / 60 / 60
    RA = h / 24 * 360
    
    # Convert declination to floating-point degrees
    d, m, s = dec.split(" ")
    sign = 1 if d.startswith("+") else -1
    d = abs(int(d)) + int(m) / 60 + float(s) / 60 / 60
    dec = d * sign
    
    star_map[id.strip()] = (RA, dec, Vmag)


def process_constellation(constellation):
    """Handles an individual constellation. Will be called in parallel below"""
    pieces = constellation.split()
    name = name_map[pieces[0]]
    ids = pieces[2:]
    ids_in_const = set(pieces[2:])
    stars_in_const = [star_map[id] for id in ids_in_const]
    line_start_ids = ids[::2]
    line_stop_ids = ids[1::2]
    
    RAs, decs, _ = zip(*stars_in_const)
    
    RA_max, RA_min, RA_mean = max(RAs), min(RAs), np.mean(RAs)
    RA_span = RA_max - RA_min
    RA_span_crosses_origin = RA_span > 180
    if RA_span_crosses_origin:
        RAs_shifted = np.array(RAs)
        RAs_shifted = (RAs_shifted + 180) % 360 - 180
        RA_mean = np.mean(RAs_shifted) % 360
    
    dec_max, dec_min, dec_mean = max(decs), min(decs), np.mean(decs)
    
    center = SkyCoord(ra=RA_mean * u.degree, dec=dec_mean * u.degree)
    max_angle = SkyCoord(ra=RA_min * u.degree, dec=dec_min * u.degree).separation(
        SkyCoord(ra=RA_max * u.degree, dec=dec_max * u.degree))
    
    # Get all stars sort of near the constellation. We'll reduce this further
    # after projecting all the coordinates
    stars_near_const_by_id = {}
    for id, dat in star_map.items():
        RA, dec, Vmag = dat
        if Vmag > VMAG_CUTOFF and id not in ids_in_const:
            continue
        coord = SkyCoord(ra=RA * u.degree, dec=dec * u.degree)
        separation = coord.separation(center)
        if separation < max_angle:
            stars_near_const_by_id[id] = dat
    
    # Build a list of stars near the constellation, with stars that are
    # actually part of the constellation at the top. This gives them lower
    # index values and reduces the size of the JSON output.
    stars_near_const = []
    # Maps Hipparchos id to index
    id_to_idx = {}
    for id in ids_in_const:
        id_to_idx[id] = len(stars_near_const)
        stars_near_const.append(stars_near_const_by_id[id])
        del stars_near_const_by_id[id]
    for id in stars_near_const_by_id:
        stars_near_const.append(stars_near_const_by_id[id])
    
    # Set up a WCS instance to project (RA, dec) to camera-plane (x, y)
    w = WCS(naxis=2)
    w.wcs.crpix = [0, 0]
    w.wcs.cdelt = [1, 1]
    w.wcs.crval = [RA_mean, dec_mean]
    w.wcs.ctype = ["RA---STG", "DEC--STG"]
    
    RAs, decs, _ = zip(*stars_in_const)
    
    # Project line coordinates
    x, y = w.wcs_world2pix(RAs, decs, 0)
    
    # Rescale these points to (0, 1)
    x_span = x.max() - x.min()
    y_span = y.max() - y.min()
    span = max(x_span, y_span)
    x_off = x.min()
    y_off = y.min()
    x = (x - x_off) / span
    y = (y - y_off) / span
    
    # Compute offsets to center constellation in the square bounding box
    dx = (1 - x.max()) / 2
    dy = (1 - y.max()) / 2
    
    # Project star coordinates
    RAs, decs, Vmags = zip(*stars_near_const)
    
    x, y = w.wcs_world2pix(RAs, decs, 0)
    x = (x - x_off) / span + dx
    y = (y - y_off) / span + dy
    
    # Filter out those stars not within the defined bounding box.
    # Since the stars that make up the constellation itself are all at the top
    # of this list, id_to_idx will not be affected
    stars_near_const = [(xx, yy, v) for xx, yy, v in zip(x, y, Vmags)
                        if (-PADDING_FRACTION/2 <= xx <= 1 + PADDING_FRACTION/2
                            and -PADDING_FRACTION/2 <= yy <= 1 + PADDING_FRACTION/2)]
    stars_near_const = list(zip(*stars_near_const))
    
    # +0.001 so that e.g. 12.999999 goes to 13
    to_int = lambda f: int(round(1-f, 3) * 1000 + 0.001)
    
    return name, {
        'lines': {'start': [id_to_idx[id] for id in line_start_ids],
                  'stop': [id_to_idx[id] for id in line_stop_ids],
                  },
        'stars': {'x': [to_int(x) for x in stars_near_const[0]],
                  'y': [to_int(y) for y in stars_near_const[1]],
                  'Vmag': [int(round(v, 1)*10) for v in stars_near_const[2]]
                  }
    }


output_data = {}
if __name__ == "__main__":
    p = multiprocessing.Pool()
    for name, data in p.imap_unordered(process_constellation, line_dat):
        output_data[name] = data
        print(f"Completed constellation {len(output_data)}/{len(line_dat)}")
    
    json.dump(output_data,
              open("../src/constellation_data.json", 'w'),
              separators=(',', ':'),
              sort_keys=True)
