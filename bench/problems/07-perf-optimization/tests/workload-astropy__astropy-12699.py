import timeit
import statistics
import astropy.units as u
    
def workload():
    u.Unit('km/s', format='fits')

runtimes = timeit.repeat(workload, number=1, repeat=2000)

print("Mean:", statistics.mean(runtimes[-1000:]))
print("Std Dev:", statistics.stdev(runtimes[-1000:]))