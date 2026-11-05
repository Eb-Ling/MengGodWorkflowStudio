using System;
using System.Runtime.InteropServices;
// Windows Job Object：插件代码加载前设置 OS 提交内存与 CPU 硬上限；管道关闭即终止所属进程。
class ResourceGuard {
  [StructLayout(LayoutKind.Sequential)] struct Basic { public long processTime, jobTime; public uint flags; public UIntPtr min, max; public uint active; public UIntPtr affinity; public uint priority, scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct Io { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic basic; public Io io; public UIntPtr processMemory, jobMemory, peakProcess, peakJob; }
  [StructLayout(LayoutKind.Sequential)] struct Cpu { public uint flags, rate; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr data, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr value);
  static void Check(bool ok) { if (!ok) throw new Exception("Win32 " + Marshal.GetLastWin32Error()); }
  static void Set<T>(IntPtr job, int kind, T value) { var p = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(T))); try { Marshal.StructureToPtr(value,p,false); Check(SetInformationJobObject(job,kind,p,(uint)Marshal.SizeOf(typeof(T)))); } finally { Marshal.FreeHGlobal(p); } }
  static int Main(string[] args) {
    IntPtr job = IntPtr.Zero, process = IntPtr.Zero;
    try {
      int pid = int.Parse(args[0]); uint mib = uint.Parse(args[1]), rate = uint.Parse(args[2]);
      if (pid <= 0 || mib < 64 || mib > 2048 || rate < 100 || rate > 10000) throw new Exception("Invalid limits");
      job = CreateJobObject(IntPtr.Zero,null); Check(job != IntPtr.Zero);
      var limits = new Extended(); limits.basic.flags = 0x2000 | 0x100; limits.processMemory = new UIntPtr((ulong)mib * 1024 * 1024);
      Set(job,9,limits); Set(job,15,new Cpu { flags=1|4, rate=rate });
      process = OpenProcess(0x100|0x1,false,pid); Check(process != IntPtr.Zero); Check(AssignProcessToJobObject(job,process));
      Console.WriteLine("READY"); Console.Out.Flush();
      while (Console.ReadLine() != null) { }
      return 0;
    } catch(Exception e) { Console.Error.WriteLine(e.Message); return 1; }
    finally { if (process != IntPtr.Zero) CloseHandle(process); if (job != IntPtr.Zero) CloseHandle(job); }
  }
}
