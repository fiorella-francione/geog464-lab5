from pathlib import Path

import geopandas as gpd
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
LOTS_FILE = ROOT / "data" / "parking_cluster.geojson"
HEAT_FILE = ROOT / "data" / "heat_island.geojson"
OUTPUT_FILE = ROOT / "data" / "parking_priority.geojson"


def main():
    lots = gpd.read_file(LOTS_FILE)
    heat = gpd.read_file(HEAT_FILE)

    if lots.crs is None or heat.crs is None:
        raise ValueError("Both parking clusters and heat polygons must define a CRS.")
    required_lot_fields = {"NOM", "TempMoyVF", "n_points"}
    missing_lot_fields = required_lot_fields - set(lots.columns)
    if missing_lot_fields:
        raise ValueError(
            f"Parking clusters are missing required fields: {sorted(missing_lot_fields)}"
        )
    missing_heat_fields = {"ClassesNB_", "ClassQual"} - set(heat.columns)
    if missing_heat_fields:
        raise ValueError(f"Heat polygons are missing fields: {sorted(missing_heat_fields)}")

    heat_polygons = heat[["ClassesNB_", "ClassQual", "geometry"]].to_crs(lots.crs)
    lots_without_old_heat = lots.drop(
        columns=["ClassesNB_", "ClassQual"], errors="ignore"
    )
    joined = gpd.sjoin(
        lots_without_old_heat,
        heat_polygons,
        how="left",
        predicate="within",
    )

    if joined.index.duplicated().any():
        raise ValueError("A parking cluster matched multiple heat polygons.")
    unmatched = joined["ClassesNB_"].isna()
    if unmatched.any():
        missing_lots = joined.loc[unmatched, "lot_id"].tolist()
        raise ValueError(f"Parking clusters did not match a heat polygon: {missing_lots}")

    joined["ClassesNB_"] = joined["ClassesNB_"].astype(float)
    joined["TempMoyVF"] = joined["TempMoyVF"].astype(float)
    joined["n_points"] = joined["n_points"].astype(float)
    if not joined["ClassesNB_"].between(1, 5).all():
        raise ValueError("Heat classes must be numeric values from 1 through 5.")
    if (
        joined["TempMoyVF"].isna().any()
        or not np.isfinite(joined["TempMoyVF"]).all()
    ):
        raise ValueError("Every parking cluster must have a finite mean temperature.")
    if joined["NOM"].isna().any() or joined["NOM"].eq("").any():
        raise ValueError("Every parking cluster must have a borough name.")
    if (
        joined["n_points"].isna().any()
        or not np.isfinite(joined["n_points"]).all()
        or (joined["n_points"] <= 0).any()
    ):
        raise ValueError("Every parking cluster must have a positive n_points value.")

    joined["heat_pct"] = joined["TempMoyVF"].rank(pct=True)
    joined["size_pct"] = np.log(joined["n_points"]).rank(pct=True)
    joined["priority_score"] = (
        0.7 * joined["heat_pct"] + 0.3 * joined["size_pct"]
    ) * 100
    joined["priority_rank"] = joined.groupby("NOM")["priority_score"].rank(
        ascending=False, method="min"
    ).astype(int)

    joined.drop(columns="index_right").to_crs("EPSG:4326").to_file(
        OUTPUT_FILE,
        driver="GeoJSON",
        COORDINATE_PRECISION=6,
    )
    print(f"Wrote {len(joined)} ranked parking clusters to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
