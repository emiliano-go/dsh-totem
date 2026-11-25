import pandas as pd
import numpy as np
import timeit
import statistics

def setup():
    global df, values
    N = 10**5
    dt_ns = pd.date_range("2022-01-01", periods=N, freq="min").to_numpy().copy()
    dt_ms = dt_ns.astype("datetime64[ms]").copy()
    dt_ns[::2] = np.datetime64('NaT')  # now works!
    dt_ms[1::2] = np.datetime64('NaT')
    df = pd.DataFrame({
        "ns_col": dt_ns,
        "ms_col": dt_ms,
        "other": np.random.randn(N)
    })
    values = {
        "ns_col": pd.Timestamp("2022-01-02"),
        "ms_col": pd.Timestamp("2022-01-03").to_datetime64()
    }

def workload():
    global df, values
    d = df.copy()
    d.fillna(value=values, inplace=True)

runtimes = timeit.repeat(workload, number=100, repeat=100, setup=setup)
print("Mean:", statistics.mean(runtimes))
print("Std Dev:", statistics.stdev(runtimes))